// app/api/cj-live/[[...path]]/route.ts — Laclarc CJ-live bridge (port من nsb/routes/cjLiveBridge.js v3.3)
// ══════════════════════════════════════════════════════════════════════
// نفس عقود الاستجابة حرفياً (field-for-field) مع الباك القديم:
//   GET /api/cj-live/geo           — كشف البلد + سجل CJ الـ 250 دولة
//   GET /api/cj-live/search        — /product/listV2 + فلتر المخازن + كاش 5د + limiter 20/10د/IP
//   GET /api/cj-live/product/:pid  — /product/query + freightCalculateTip (صف v3.3) + fallback تقدير
//   GET /api/cj-live/reviews/:pid  — /product/productComments + كاش 6h
// التسعير: قانون v3.1 بالفريت الحقيقي (shipOverrideUsd) — السر ما كيمشيش للعميل.
// ══════════════════════════════════════════════════════════════════════
import { NextRequest, NextResponse } from 'next/server';
import {
  cjFetch,
  CjEnvelopeError,
  cacheGet,
  cacheSet,
  searchCache,
  freightCache,
  SEARCH_TTL,
  FREIGHT_TTL,
  allowHit,
  bridgeIp,
  resolveVisitorCountry,
  geoNormalize,
  geoCountryName,
  geoRegistryCount,
  calculateSellingPrice,
  sanitizeDescription,
  parseMaxNumber,
  parseWeightGrams,
  parseJsonArray,
  parseImageList,
  asRec,
  asArr,
  asStr,
  getWarehouseCountries,
  freightDiagnose,
  fetchCjReviews,
  type FreightDiagReason,
} from '@/lib/cf-cj';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const PID_RE = /^[A-Za-z0-9_-]{5,32}$/; // معرف snowflake من CJ — charset/طول محصورين

// ── أنواع الاستجابات (نفس حقول الباك) ────────────────────────────────

interface CjSearchProduct {
  pid: string;
  title: string;
  laclarcPrice: number;
  image: string;
  ordersCount: number;
  deliveryCycle: string;
  isVideo: boolean;
}

interface CjSearchGeo {
  country: string;
  name: string;
  supported: boolean;
  source: string;
  filterMode: string;
}

interface SearchPayload {
  products: CjSearchProduct[];
  page: number;
  hasMore: boolean;
  totalRecords: number;
  geo: CjSearchGeo;
}

interface FreightOption {
  amount: number;
  name: string;
  id: unknown;
  arrivalTime: string;
}

type ShippingResult =
  | { source: 'unavailable'; amount: number; currency: string }
  | { source: 'cj-error'; cjCode: number | null; cjMessage: string | null }
  | { source: 'estimate'; amount: number; currency: string; cjError?: { cjCode: number | null } }
  | {
      source: 'cj-live';
      amount: number;
      currency: string;
      channelName: string;
      channelId: unknown;
      arrivalTime: string;
      srcAreaCode: string;
      options: FreightOption[];
    };

interface FreightDebug {
  dest: string | null;
  srcAreaCode: string | null;
  weight: number | null;
  volumeCm3: number | null;
  productProp: string | null;
  row: Record<string, unknown> | null;
  envCode: number | null;
  rawType: string | null;
  channelCount: number | null;
  validCount: number;
  fromCache: boolean;
  diag: FreightDiagReason[] | null;
}

// ══════════════════════════════════════════════════════════════════════
// GET /api/cj-live/geo — كشف البلد + باب الـ 250
// 200 { country, name, supported, source, registryCount, freightReady }
// ══════════════════════════════════════════════════════════════════════
async function handleGeo(request: NextRequest): Promise<NextResponse> {
  try {
    const g = await resolveVisitorCountry(request);
    return NextResponse.json({
      country: g.code,
      name: geoCountryName(g.code),
      supported: g.supported,
      source: g.source,
      registryCount: geoRegistryCount(),
      freightReady: g.supported, // الشحن الحقيقي ممكن فقط للدول المدعومة
      // عنوان IP ما كيرجعش للعميل (privacy)
    });
  } catch (e) {
    console.warn('[cj-live/geo]', e instanceof Error ? e.message : e);
    const def = geoNormalize(process.env.DEFAULT_COUNTRY) || 'US';
    return NextResponse.json({
      country: def,
      name: geoCountryName(def),
      supported: true,
      source: 'default',
      registryCount: geoRegistryCount(),
      freightReady: true,
    });
  }
}

// ══════════════════════════════════════════════════════════════════════
// GET /api/cj-live/search?q=&page=&country=
// /product/listV2 (50pt) — countryCode = فلتر المخازن فقط (ماشي بلد التوصيل)
// ══════════════════════════════════════════════════════════════════════
async function handleSearch(request: NextRequest): Promise<NextResponse> {
  try {
    const url = new URL(request.url);
    const q = String(url.searchParams.get('q') || '').trim().slice(0, 80);
    const page = Math.min(Math.max(1, parseInt(url.searchParams.get('page') || '', 10) || 1), 300);
    if (q.length < 2) return NextResponse.json({ geo: {}, products: [], page, hasMore: false });

    // البلد: override → CDN → IP lookup → default (كاش IP داخلي 24h)
    const g = await resolveVisitorCountry(request);
    const country = g.supported ? g.code : null; // غير مدعوم → وضع عالمي بلا فلتر

    // الكاش قبل الـ limiter — الضربة المدفوعة (50pt) غير على MISS
    const ckey = `${q.toLowerCase()}|${page}|${country || '*'}`;
    const cached = cacheGet<SearchPayload>(searchCache, ckey, SEARCH_TTL);
    if (cached) return NextResponse.json({ ...cached, cached: true });

    // limiter — فقط على الطلبات اللي غادي تضرب CJ فعلاً (IP حقيقي، ماشي XFF مزوّر)
    if (!allowHit('search', bridgeIp(request))) {
      return NextResponse.json({ error: 'Too many searches. Try again later.' }, { status: 429 });
    }

    const query: Record<string, string | number | undefined> = { keyWord: q, page, size: 20 }; // listV2: keyWord (ماشي keyword ديال V1)

    // countryCode = فلتر المخزون فالبلاد المحددة — بلد المخزن، ماشي بلد التوصيل!
    // بلد بلا مخزن CJ → كاطالوغ عالمي بلا فلتر — التوصيل كيتأكد بالفريت الحقيقي فالـ PDP.
    let filterMode = 'worldwide';
    if (country) {
      const wh = await getWarehouseCountries();
      if (wh.has(country)) {
        query.countryCode = country;
        filterMode = 'warehouse';
      }
    }
    const geoInfo: CjSearchGeo = {
      country: g.code,
      name: geoCountryName(g.code),
      supported: g.supported,
      source: g.source,
      filterMode,
    };

    const r = await cjFetch('/product/listV2', { query, timeoutMs: 15000 });

    // فحص envelope — listV2 كيرجع 200 أو 0؛ أي كود آخر = خطأ حقيقي (نقاط/أوث/باراميتر)
    const envCode = r.data?.code;
    if (envCode !== 200 && envCode !== 0) {
      console.warn('[cj-live/search][cj-envelope]', envCode ?? null, r.data?.message || '');
      return NextResponse.json({ error: 'CJ unavailable', cjCode: envCode ?? null }, { status: 502 });
      // رسالة CJ الداخلية ما كتمشيش للعميل (اللوج كامل سيرفر-side)
    }

    const d = asRec(r.data?.data);
    const rawContent = asArr(d.content);
    // الشكل الحقيقي ديال listV2: content[i] = مجموعة { productList, keyWord, relatedCategoryList }
    // كنفككو productList مع حماية للشكل المسطح (توافقية إلا تبدل CJ)
    const list = rawContent.flatMap((rawG) => {
      const group = asRec(rawG);
      if (Array.isArray(group.productList)) return group.productList;
      return group.id || group.pid || group.nameEn ? [rawG] : [];
    });
    const totalRecords = parseInt(String(d.totalRecords ?? ''), 10) || 0;

    const products = list
      .map((rawP) => {
        const p = asRec(rawP);
        // التسعير المقدر فاللائحة (500g) — التفاصيل كتجيب الفريت الحقيقي
        // (parseMaxNumber(Infinity) = 0 → floor price — نفس سلوك الباك للمنتجات بلا أثمنة)
        const cost =
          Math.min(
            ...[p.discountPrice, p.nowPrice, p.sellPrice]
              .map((v) => parseMaxNumber(v))
              .filter((v) => v > 0),
          ) ||
          parseMaxNumber(p.sellPrice) ||
          0;
        const { safePrice } = calculateSellingPrice(cost, 500);
        return {
          pid: String(p.id || p.pid || ''),
          title: asStr(p.nameEn || p.productNameEn || ''),
          // كلفة CJ (`price`) ما كتمشيش للعميل — least-data
          laclarcPrice: safePrice,
          image: asStr(p.bigImage || p.productImage || ''),
          ordersCount: parseInt(String(p.listedNum ?? p.ordersCount ?? ''), 10) || 0,
          deliveryCycle: asStr(p.deliveryCycle || ''), // "3-5" أيام — من listV2 مباشرة
          isVideo: Boolean(p.isVideo),
        };
      })
      .filter((p) => p.pid);

    const payload: SearchPayload = {
      products,
      page,
      hasMore: list.length >= 20 && page < Math.min(parseInt(String(d.totalPages ?? ''), 10) || 1000, 300),
      totalRecords,
      geo: geoInfo, // داخل الكاش — hits كيرجعو بالـ geo كاملة (فيها filterMode)
    };
    cacheSet(searchCache, ckey, payload);
    return NextResponse.json({ ...payload, cached: true });
  } catch (e) {
    console.warn('[cj-live/search]', e instanceof Error ? e.message : e);
    return NextResponse.json({ error: 'CJ unavailable' }, { status: 502 });
  }
}

// ══════════════════════════════════════════════════════════════════════
// GET /api/cj-live/product/:pid?country=&vid=&debug=1
// /product/query + freightCalculateTip (صف v3.3) — الثمن المباشر
// ══════════════════════════════════════════════════════════════════════
async function handleProduct(request: NextRequest, pidRaw: string): Promise<NextResponse> {
  try {
    const url = new URL(request.url);
    const pid = String(pidRaw || '').trim();
    if (!pid || !PID_RE.test(pid)) return NextResponse.json({ error: 'Bad pid' }, { status: 400 });
    if (!allowHit('product', bridgeIp(request))) {
      return NextResponse.json({ error: 'Too many requests. Try again later.' }, { status: 429 });
    }

    const r = await cjFetch('/product/query', {
      query: { pid, features: 'enable_video' },
      timeoutMs: 15000,
    });

    const envCodeQ = r.data?.code;
    if (envCodeQ !== 200 && envCodeQ !== 0) {
      console.warn('[cj-live/product][cj-envelope]', envCodeQ ?? null, r.data?.message || '');
      return NextResponse.json({ error: 'CJ unavailable', cjCode: envCodeQ ?? null }, { status: 502 });
    }
    const d = asRec(r.data?.data);
    if (!d.pid) return NextResponse.json({ error: 'Product not found' }, { status: 404 });

    // البلد — للفريت الحقيقي
    const g = await resolveVisitorCountry(request);
    const dest = g.supported ? g.code : null;
    const geoInfo = {
      country: g.code,
      name: geoCountryName(g.code),
      supported: g.supported,
      source: g.source,
    };

    // الوزن الحقيقي (المستوى المنتج)
    const weight = Math.max(parseWeightGrams(d.productWeight), parseWeightGrams(d.packingWeight));

    // productProp — من productProEnSet (Appendix D) — شرط صلب للفريت
    // (الباك: parseJsonArray كيرجع [] دايماً truthy → fallbacks ديال || ما كيوصلوش — نسخ مطابق)
    const proList = parseJsonArray(d.productProEnSet);
    const rawProp = proList.find((x) => typeof x === 'string' && x.trim());
    const productProp =
      typeof rawProp === 'string' && rawProp.trim() && !/^PROOERTY$/i.test(rawProp.trim())
        ? String(rawProp.trim()).slice(0, 40)
        : 'COMMON';

    // الحجم — L/W/H (mm) من أول variant → cm3
    const rawVariants = asArr(d.variants);
    const v0 = asRec(rawVariants[0]);
    const numF = (o: Record<string, unknown>, keys: string[]): number => {
      for (const k of keys) {
        const n = parseFloat(String(o?.[k]));
        if (n > 0 && Number.isFinite(n)) return n;
      }
      return 0;
    };
    const L = numF(v0, ['length', 'variantLength', 'productLength', 'long']);
    const W = numF(v0, ['width', 'variantWidth', 'productWidth']);
    const H = numF(v0, ['height', 'variantHeight', 'productHeight']);
    const volumeCm3 = L && W && H ? Math.round((L * W * H) / 1000) : 0;

    // srcAreaCode — من مخزون أول variant: المخزن المحلي إن وجد، وإلا CN
    const invCountries = asArr(v0.inventories)
      .filter((rawI) => {
        const i = asRec(rawI);
        return (
          parseInt(String(i.totalInventory ?? ''), 10) || parseInt(String(i.cjInventory ?? ''), 10) || 0
        ) > 0;
      })
      .map((rawI) => geoNormalize(asRec(rawI).countryCode))
      .filter((c): c is string => Boolean(c));
    const srcAreaCode =
      dest && invCountries.includes(dest)
        ? dest
        : invCountries.includes('CN')
          ? 'CN'
          : invCountries[0] || 'CN';

    // freightCalculateTip — الثمن المباشر (10pt) — كاش 10 دقائق
    // (قبل mapping الـ variants باش v0 ياخد الفريت الحقيقي فالتسعير —
    //  Add-to-Cart كيستعمل laclarcVariantPrice → خاصو يطابق laclarcPrice المعروض)
    const cost0 = parseMaxNumber(v0.variantSellPrice) || parseMaxNumber(d.sellPrice) || 0;
    let shipping: ShippingResult = { source: 'unavailable', amount: 0, currency: 'USD' };
    let freightUsd = 0;
    let emptyDiag: FreightDiagReason[] | null = null; // أسباب 1.3 ملي CJ كيرجع 200 بقنوات خاوية (سيرفر-side برك)
    const dbg: FreightDebug = {
      dest: dest ?? null,
      srcAreaCode: null,
      weight: null,
      volumeCm3: null,
      productProp: null,
      row: null,
      envCode: null,
      rawType: null,
      channelCount: null,
      validCount: 0,
      fromCache: false,
      diag: null,
    };

    if (dest) {
      dbg.srcAreaCode = srcAreaCode;
      dbg.weight = Math.max(weight, 1);
      dbg.volumeCm3 = volumeCm3;
      dbg.productProp = productProp;
      const fkey = `${pid}|${v0.vid ? String(v0.vid) : 'x'}|${srcAreaCode}|${dest}`;
      const cachedF = cacheGet<unknown>(freightCache, fkey, FREIGHT_TTL);
      let channels: unknown = Array.isArray(cachedF) ? cachedF : null; // {__empty} = كاش سلبي تشخيصي
      if (cachedF) {
        dbg.fromCache = true;
        const neg = asRec(cachedF);
        if (neg.__empty) emptyDiag = asArr(neg.unavailable) as FreightDiagReason[];
      }

      if (!cachedF) {
        // صف الطلب [freight-row] — نسخة طبق الأصل من CURL الرسمي ديال freightCalculateTip:
        //   · productProp = مصفوفة ["…"] (الشكل الرسمي — ماشي String!)
        //   · freightTrialSkuList + skuList = Y فالتوثيق — بلاتهم CJ كيرجع 200 بقنوات خاوية
        //   · volume (Y) + totalGoodsAmount كيما فالمثال الرسمي
        const vSku = v0.variantSku ? String(v0.variantSku) : '';
        const row: Record<string, unknown> = {
          srcAreaCode,
          destAreaCode: dest,
          weight: Math.max(weight, 1), // شرط صلب: weight > 0
          productProp: [productProp], // شرط صلب — مصفوفة (CURL الرسمي)
          productTypes: [0],
        };
        if (volumeCm3 > 0) row.volume = volumeCm3;
        if (cost0 > 0) row.totalGoodsAmount = +cost0.toFixed(2);
        if (vSku) {
          row.skuList = [vSku];
          row.freightTrialSkuList = [{ skuQuantity: 1, sku: vSku }];
        }
        dbg.row = row;

        try {
          const fr = await cjFetch('/logistic/freightCalculateTip', {
            method: 'POST',
            body: { reqDTOS: [row] },
            timeoutMs: 15000,
          });
          const fenv = fr.data;
          dbg.envCode = fenv?.code ?? null;
          if (!fenv || (fenv.code !== 200 && fenv.code !== 0)) {
            // خطأ envelope ديال CJ (نقاط/أوث) — نسجلو بالعلم، الفريت غادي يرجع للتقدير
            console.warn('[cj-live/product][freight][cj-envelope]', fenv?.code ?? null, fenv?.message || '');
            shipping = {
              source: 'cj-error',
              cjCode: fenv?.code ?? null,
              cjMessage: String(fenv?.message || '') || null,
            };
          } else {
            const fd = fenv.data;
            dbg.rawType = Array.isArray(fd) ? 'array' : fd && typeof fd === 'object' ? 'object' : typeof fd;
            const fdRec = asRec(fd);
            channels = Array.isArray(fd)
              ? fd
              : fdRec.list || fdRec.channels || fdRec.content || fdRec.rows || [];
            if ((channels as { length?: number })?.length) {
              cacheSet(freightCache, fkey, channels);
            } else {
              // 200 بقنوات خاوية — CJ ما قدرش يسعّر هاد الـ route (بلا سبب فالجواب)
              //   1.3 unavailableShippingMethods (10pt) بنفس الـ payload كيقول علاش
              console.warn('[cj-live/product][freight][empty]', JSON.stringify(row), JSON.stringify(fd).slice(0, 300));
              emptyDiag = await freightDiagnose(row);
              dbg.diag = emptyDiag;
              cacheSet(freightCache, fkey, { __empty: true, unavailable: emptyDiag }); // كاش سلبي — حماية النقاط
            }
          }
        } catch (fe) {
          console.warn('[cj-live/product][freight]', fe instanceof Error ? fe.message : fe);
          dbg.rawType = 'throw: ' + String(fe instanceof Error ? fe.message : fe);
        }
      }

      const chList = Array.isArray(channels) ? channels : [];
      dbg.channelCount = chList.length; // كاش ولا MISS — نفس الحساب

      // أرخص قناة صالحة → totalPostageFee = الثمن المباشر المعروض
      const valid = chList
        .map((rawC) => {
          const c = asRec(rawC);
          const ch = asRec(c.channel);
          const opt = asRec(c.option);
          return {
            amount:
              parseMaxNumber(c.totalPostageFee) ||
              (parseMaxNumber(c.wrapPostage) || parseMaxNumber(c.postage) || 0) +
                (parseMaxNumber(c.taxesFee) || 0) +
                (parseMaxNumber(c.tariff) || 0),
            name: asStr(ch.enName || c.enName || c.logisticName || ''),
            id: ch.id ?? opt.id ?? null,
            arrivalTime: asStr(c.arrivalTime || opt.arrivalTime || ''),
          };
        })
        .filter((c) => c.amount > 0)
        .sort((a, b) => a.amount - b.amount);
      dbg.validCount = valid.length;

      if (valid.length) {
        freightUsd = valid[0].amount;
        shipping = {
          source: 'cj-live',
          amount: freightUsd,
          currency: 'USD',
          channelName: valid[0].name,
          channelId: valid[0].id,
          arrivalTime: valid[0].arrivalTime,
          srcAreaCode,
          options: valid.slice(0, 3), // أفضل 3 قنوات للعرض
        };
      }
    }

    if (shipping.source !== 'cj-live') {
      // fallback — تقدير v3.1 القديم (نفس المعادلة، ثوابت 5/4 كيما فالباك)
      // cjError = كود CJ (تشخيصي — بلا رسالة داخلية)
      const cjErr = shipping.source === 'cj-error' ? { cjCode: shipping.cjCode ?? null } : null;
      shipping = {
        source: 'estimate',
        amount: +(5 + (Math.max(weight, 50) / 1000) * 4).toFixed(2),
        currency: 'USD',
        ...(cjErr ? { cjError: cjErr } : {}),
        // أسباب 1.3 (unavailable) ما كتمشيش للعميل — الفرونتend ما كيستهلكهاش
      };
    }

    // أسعار الـ variants — وزن الـ variant نفسه
    // v0 كياخد الفريت الحقيقي (shipOverride) — الباقي تقدير (بلا حرق نقاط إضافية)
    const mappedVariants = rawVariants.map((rawV, idx) => {
      const v = asRec(rawV);
      const vWeight = Math.max(parseWeightGrams(v.weight), 0) || weight;
      const vCost = parseMaxNumber(v.variantSellPrice) || parseMaxNumber(d.sellPrice) || 0;
      const vFreight = idx === 0 && freightUsd > 0 ? freightUsd : null;
      return {
        vid: v.vid,
        variantKey: asStr(v.variantKey || ''),
        // كلفة الـ variant (variantSellPrice = wholesale CJ) ما كتمشيش للعميل
        laclarcVariantPrice: calculateSellingPrice(vCost, vWeight, vFreight).safePrice,
        inventoryCountries: asArr(v.inventories)
          .filter((rawI) => (parseInt(String(asRec(rawI).totalInventory ?? ''), 10) || 0) > 0)
          .map((rawI) => geoNormalize(asRec(rawI).countryCode))
          .filter((c): c is string => Boolean(c)),
      };
    });

    // السعر الرسمي: قانون v3.1 بالفريت الحقيقي (shipOverrideUsd)
    const { safePrice } = calculateSellingPrice(cost0, weight, freightUsd > 0 ? freightUsd : null);

    if (url.searchParams.get('debug')) {
      // تشخيص سيرفر-side فقط — ما كيرجعش فالجواب
      // (نفس v3.3 النهائي: freightDebug تحيد من الطريق العام)
      console.warn('[cj-live/product][debug]', JSON.stringify(dbg).slice(0, 2000));
    }

    return NextResponse.json({
      pid: String(d.pid),
      title: asStr(d.productNameEn || ''),
      description: sanitizeDescription(d.description || ''), // XSS shield
      bigImage: asStr(d.bigImage || ''),
      images: parseImageList(d, { includeVariantImages: false, max: 12 }),
      variants: mappedVariants,
      // sellPrice/weightGrams/productProp (كلفة CJ + بيانات تشغيلية) ما كيمشيش للعميل
      laclarcPrice: safePrice, // السعر الرسمي — فريت حقيقي إن توفر، وإلا تقدير
      original_price: null, // قرار 1 — بلا strikethrough مولّد
      estimatedShipUsd: shipping.amount, // توافقية خلفية + القيمة الحقيقية إن توفرت
      shipping, // الثمن المباشر الكامل
      geo: geoInfo, // بلد الزائر المستعملة
    });
  } catch (e) {
    console.warn('[cj-live/product]', e instanceof Error ? e.message : e);
    return NextResponse.json({ error: 'CJ unavailable' }, { status: 502 });
  }
}

// ══════════════════════════════════════════════════════════════════════
// GET /api/cj-live/reviews/:pid?page=&size=&score= — وكيل ريفيوزات CJ
// 200 { total, page, size, reviews: [{ id, name, score, date, text, images, country, flag }] }
// ══════════════════════════════════════════════════════════════════════
async function handleReviews(request: NextRequest, pidRaw: string): Promise<NextResponse> {
  try {
    const url = new URL(request.url);
    const pid = String(pidRaw || '').trim();
    if (!pid || !PID_RE.test(pid)) return NextResponse.json({ error: 'Bad pid' }, { status: 400 });
    if (!allowHit('reviews', bridgeIp(request))) {
      return NextResponse.json({ error: 'Too many requests. Try again later.' }, { status: 429 });
    }
    const data = await fetchCjReviews(pid, {
      page: Math.min(Math.max(1, parseInt(url.searchParams.get('page') || '', 10) || 1), 200),
      size: url.searchParams.get('size') ?? undefined,
      score: url.searchParams.get('score') ?? undefined,
    });
    return NextResponse.json(data);
  } catch (e) {
    console.warn('[cj-live/reviews]', e instanceof Error ? e.message : e);
    const cjCode = e instanceof CjEnvelopeError ? e.cjCode : null;
    return NextResponse.json({ error: 'CJ unavailable', cjCode }, { status: 502 });
  }
}

// ══════════════════════════════════════════════════════════════════════
// توجيه الـ catch-all — نفس مسارات الراوتر القديم (Express)
// ══════════════════════════════════════════════════════════════════════
export async function GET(
  request: NextRequest,
  ctx: { params: Promise<{ path?: string[] }> },
): Promise<Response> {
  const { path } = await ctx.params;
  const seg = path ?? [];
  if (seg.length === 1 && seg[0] === 'geo') return handleGeo(request);
  if (seg.length === 1 && seg[0] === 'search') return handleSearch(request);
  if (seg.length === 2 && seg[0] === 'product') return handleProduct(request, seg[1]);
  if (seg.length === 2 && seg[0] === 'reviews') return handleReviews(request, seg[1]);
  return NextResponse.json({ error: 'Not found' }, { status: 404 });
}
