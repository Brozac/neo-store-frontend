'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Script from 'next/script';

export default function HeroSection() {
  const [liveTime, setLiveTime] = useState('');
  const [isMounted, setIsMounted] = useState(false);

  // تحديث التوقيت العالمي الحي لحظياً
  useEffect(() => {
    setIsMounted(true);
    const updateTime = () => {
      const now = new Date();
      setLiveTime(
        now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) + 
        ' • ' + 
        now.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })
      );
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  // تشغيل أنيميشن GSAP بعد اكتمال تحميل المكتبة بأمان
  const initGSAP = () => {
    if (typeof window === 'undefined' || !(window as any).gsap) return;
    const gsap = (window as any).gsap;
    const ScrollTrigger = (window as any).ScrollTrigger;

    if (ScrollTrigger) {
      gsap.registerPlugin(ScrollTrigger);
    }

    // 1. أنيميشن الدخول الأولي
    const tl = gsap.timeline();
    tl.from(".gsap-nav", { y: -20, opacity: 0, duration: 0.8, stagger: 0.15, ease: "power2.out" })
      .from(".gsap-bg-text", { scale: 0.92, opacity: 0, duration: 1.2, ease: "power2.out" }, "-=0.6")
      .from(".gsap-parallax-img", { y: 60, opacity: 0, duration: 1.2, ease: "power3.out" }, "-=0.9")
      .from(".gsap-hero", { y: 30, opacity: 0, duration: 0.8, stagger: 0.1, ease: "power3.out" }, "-=0.8");

    // 2. طفو الصلصال الفيزيائي المستمر
    gsap.utils.toArray(".float-anim").forEach((el: any, i: number) => {
      gsap.to(el, {
        y: "-=8",
        rotation: 0.8,
        duration: 2.6 + i * 0.2,
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut",
        delay: i * 0.1
      });
    });

    gsap.to(".float-anim-slow", {
      y: "-=14",
      duration: 3.8,
      repeat: -1,
      yoyo: true,
      ease: "sine.inOut"
    });

    // 3. تأثير الـ Parallax عند التمرير (بدون تضارب)
    if (ScrollTrigger) {
      gsap.to(".bg-text", {
        y: -120,
        ease: "none",
        scrollTrigger: {
          trigger: ".hero",
          start: "top top",
          end: "bottom top",
          scrub: 1
        }
      });

      gsap.to(".gsap-parallax-img", {
        y: 60,
        scale: 0.96,
        ease: "none",
        scrollTrigger: {
          trigger: ".hero",
          start: "top top",
          end: "bottom top",
          scrub: 1
        }
      });

      gsap.from(".gsap-s2", {
        y: 40,
        opacity: 0,
        duration: 1,
        stagger: 0.2,
        ease: "power3.out",
        scrollTrigger: {
          trigger: ".bottom-section",
          start: "top 75%"
        }
      });

      gsap.from(".gsap-pill", {
        y: 50,
        opacity: 0,
        scale: 0.85,
        rotation: () => gsap.utils.random(-6, 6),
        duration: 0.9,
        stagger: 0.12,
        ease: "back.out(1.4)",
        scrollTrigger: {
          trigger: ".pill-container",
          start: "top 85%"
        }
      });
    }

    // 4. تأثير ارتداد الصلصال عند النقر
    const clayButtons = document.querySelectorAll(".giant-pill, .clay-widget, .btn-dark");
    clayButtons.forEach((btn) => {
      btn.addEventListener("mousedown", () => gsap.to(btn, { scale: 0.96, duration: 0.1 }));
      btn.addEventListener("mouseup", () => gsap.to(btn, { scale: 1, duration: 0.25, ease: "back.out(2)" }));
      btn.addEventListener("mouseleave", () => gsap.to(btn, { scale: 1, duration: 0.2 }));
    });
  };

  return (
    <div className="laclarc-hero-wrapper">
      {/* تحميل مكتبة GSAP للأنيميشن الاحترافي */}
      <Script 
        src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/gsap.min.js" 
        strategy="afterInteractive" 
      />
      <Script 
        src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/ScrollTrigger.min.js" 
        strategy="afterInteractive"
        onLoad={initGSAP}
      />

      {/* Hero Section */}
      <section className="hero">
        {/* كلمة LACLARC العملاقة في الخلفية */}
        <div className="bg-text gsap-bg-text">LACLARC</div>

        {/* المنتج المعروض في المنتصف (صورة مفرغة شفافة فاخرة) */}
        <div className="hero-img-wrap gsap-parallax-img">
          <img 
            className="hero-main-img float-anim-slow" 
            src="https://pngimg.com/d/electric_shaver_PNG13.png" 
            alt="Laclarc Luxury Electric Grooming Innovation" 
          />
        </div>

        {/* الجانب الأيسر: العنوان وزر الشراء المباشر */}
        <div className="hero-left">
          <span className="label gsap-hero">⚡ Exclusive Curated Drops</span>
          <h1 className="gsap-hero">
            Engineered for precision,<br />
            crafted for lifestyle,<br />
            <span>delivered worldwide.</span>
          </h1>

          <div className="reviews gsap-hero">
            <span className="stars">★★★★★</span>
            <span>4.9/5 from 12,000+ Verified Buyers</span>
          </div>

          <div className="hero-actions gsap-hero">
            <Link href="#catalog" className="btn-dark">
              Shop Trending Deals <span className="arrow">⚡</span>
            </Link>
            <Link href="/categories" className="btn-glass">
              All Departments
            </Link>
          </div>
        </div>

        {/* الجانب الأيمن: ويدجت الصلصال ثلاثي الأبعاد + التصنيفات */}
        <div className="hero-right">
          <div className="clay-widget float-anim gsap-hero">
            <div className="widget-img">
              {/* أيقونة Laclarc */}
              <span className="text-3xl font-black text-white tracking-widest">L</span>
            </div>
            <div className="widget-info">
              <div className="w-top">
                <span className="w-title">Worldwide<br />Express Dispatch.</span>
                <div className="w-dot"></div>
              </div>
              <div className="w-bottom">
                <div className="w-line"></div>
                <div className="w-controls">
                  <div className="w-ctrl">✓</div>
                  <div className="w-ctrl">✈</div>
                </div>
              </div>
            </div>
          </div>

          <div className="partners gsap-hero">
            <div className="p-label">Curated Collections</div>
            <div className="p-logos">
              <span>Electric Grooming</span>
              <span>Smart Tech</span>
              <span>Lifestyle</span>
              <span>Watches</span>
              <span>Home Decor</span>
            </div>
          </div>
        </div>

        {/* الشريط السفلي للهيرو */}
        <div className="hero-footer gsap-nav">
          <span>• 100% Buyer Protection</span>
          <span>• Direct CJ Dropshipping Fulfillment</span>
          <span>• Scroll to Explore ↓</span>
        </div>
      </section>

      {/* القسم الثاني: معلومات الضمان والـ Giant Pills ثلاثية الأبعاد */}
      <section className="bottom-section">
        <div className="wireframe-globe"></div>

        <div className="s2-content">
          <div className="s2-left gsap-s2">
            <div className="about-label">
              <div className="dot"></div> The Laclarc Standard
            </div>
            <div className="hub-info">
              <svg viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="2" y1="12" x2="22" y2="12"></line>
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
              </svg>
              Insured Worldwide Shipping across USA, Europe, Algeria (BaridiMob), and Gulf
            </div>
          </div>

          <div className="s2-right gsap-s2">
            <h2>
              Premium curated quality meets accessibility:<br />
              <span>Speed, style, and </span> excellence without <span>compromise.</span>
            </h2>

            <div className="social-bar">
              <div className="s-icons">
                <span className="s-label">Connect with Laclarc</span>
                <a href="https://facebook.com" target="_blank" rel="noreferrer" className="s-icon purple">fb</a>
                <a href="https://instagram.com" target="_blank" rel="noreferrer" className="s-icon pink">ig</a>
                <a href="https://tiktok.com" target="_blank" rel="noreferrer" className="s-icon">tk</a>
              </div>
              <Link href="/categories" className="about-btn">
                Discover Catalog &rarr;
              </Link>
            </div>
          </div>
        </div>

        {/* كبسولات الـ 3D Clay Pills بألوان المتجر الفاخرة */}
        <div className="pill-container">
          <div className="giant-pill pill-white float-anim gsap-pill">Sourced</div>
          <div className="giant-pill pill-purple float-anim-alt gsap-pill">Verified</div>
          <div className="giant-pill pill-black float-anim gsap-pill">
            <span className="text-3xl">⚡</span>
          </div>
          <div className="giant-pill pill-pink float-anim-alt gsap-pill">Delivered</div>
        </div>
      </section>

      {/* الستايل المتطور المدمج المخصص لألوان Laclarc */}
      <style jsx>{`
        .laclarc-hero-wrapper {
          --bg-top: #F9F8FC;
          --bg-bottom: #FFFFFF;
          --text-dark: #1D1E3C;
          --text-muted: #6B7280;
          --brand-purple: #8B78C6;
          --brand-pink: #FF6B9D;
          --brand-navy: #1D1E3C;
          
          /* Claymorphism 3D Shadows */
          --shadow-light: 8px 10px 20px rgba(139, 120, 198, 0.08),
            -8px -10px 20px rgba(255, 255, 255, 0.9),
            inset 2px 2px 5px rgba(255, 255, 255, 1),
            inset -2px -2px 5px rgba(139, 120, 198, 0.05);

          --shadow-dark: 10px 10px 25px rgba(29, 30, 60, 0.25),
            -5px -5px 15px rgba(255, 255, 255, 0.2),
            inset 2px 2px 5px rgba(255, 255, 255, 0.15),
            inset -2px -2px 5px rgba(0, 0, 0, 0.5);

          --shadow-purple: 8px 10px 25px rgba(139, 120, 198, 0.3),
            -4px -4px 10px rgba(255, 255, 255, 0.6),
            inset 2px 2px 5px rgba(255, 255, 255, 0.35),
            inset -2px -2px 5px rgba(0, 0, 0, 0.2);

          --shadow-pink: 8px 10px 25px rgba(255, 107, 157, 0.3),
            -4px -4px 10px rgba(255, 255, 255, 0.6),
            inset 2px 2px 5px rgba(255, 255, 255, 0.35),
            inset -2px -2px 5px rgba(0, 0, 0, 0.2);

          --shadow-glass: 0 8px 32px 0 rgba(29, 30, 60, 0.06),
            inset 1px 1px 2px rgba(255, 255, 255, 0.8);

          font-family: 'Inter', sans-serif;
          background-color: var(--bg-top);
          color: var(--text-dark);
          overflow-x: hidden;
          width: 100%;
        }

        .hero {
          position: relative;
          min-height: 95vh;
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 80px 48px 60px;
          overflow: hidden;
        }

        .bg-text {
          position: absolute;
          bottom: 12vh;
          left: 50%;
          transform: translateX(-50%);
          font-size: 21vw;
          font-weight: 900;
          line-height: 0.8;
          white-space: nowrap;
          z-index: 1;
          letter-spacing: -1.2vw;
          background: linear-gradient(180deg, rgba(139, 120, 198, 0.15) 0%, rgba(255, 255, 255, 0) 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          pointer-events: none;
          user-select: none;
        }

        .hero-img-wrap {
          position: absolute;
          bottom: 4vh;
          left: 50%;
          transform: translateX(-50%);
          height: 70vh;
          max-width: 80vw;
          z-index: 5;
          display: flex;
          align-items: flex-end;
          justify-content: center;
          pointer-events: none;
        }

        .hero-main-img {
          max-height: 100%;
          max-width: 100%;
          object-fit: contain;
          object-position: bottom;
          filter: drop-shadow(0 35px 50px rgba(29, 30, 60, 0.22));
          will-change: transform;
        }

        .hero-left {
          position: relative;
          z-index: 10;
          max-width: 490px;
        }

        .label {
          font-size: 11px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 1px;
          margin-bottom: 20px;
          display: inline-block;
          color: var(--brand-purple);
          background: rgba(139, 120, 198, 0.12);
          border: 1px solid rgba(139, 120, 198, 0.25);
          padding: 6px 14px;
          border-radius: 20px;
        }

        .hero h1 {
          font-size: clamp(34px, 3.8vw, 56px);
          font-weight: 800;
          line-height: 1.08;
          letter-spacing: -1.5px;
          margin-bottom: 24px;
          color: var(--brand-navy);
        }
        .hero h1 span {
          color: var(--brand-purple);
        }

        .reviews {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 13px;
          font-weight: 700;
          margin-bottom: 36px;
          color: var(--brand-navy);
        }
        .stars {
          color: #f59e0b;
          letter-spacing: 2px;
          font-size: 14px;
        }

        .hero-actions {
          display: flex;
          gap: 14px;
          flex-wrap: wrap;
        }

        .btn-dark {
          background: linear-gradient(135deg, #1D1E3C 0%, #2D2E5C 100%);
          color: white;
          padding: 14px 28px;
          border-radius: 30px;
          display: flex;
          align-items: center;
          gap: 12px;
          font-size: 14px;
          font-weight: 700;
          text-decoration: none;
          box-shadow: var(--shadow-dark);
          transition: all 0.25s ease;
        }
        .btn-dark:hover {
          transform: translateY(-2px);
          box-shadow: 0 16px 30px rgba(29, 30, 60, 0.35);
        }
        .btn-dark .arrow {
          background: var(--brand-pink);
          color: white;
          width: 24px;
          height: 24px;
          border-radius: 50%;
          display: flex;
          justify-content: center;
          align-items: center;
          font-size: 12px;
        }

        .btn-glass {
          background: rgba(255, 255, 255, 0.8);
          border: 1px solid rgba(139, 120, 198, 0.3);
          padding: 14px 28px;
          border-radius: 30px;
          font-size: 14px;
          font-weight: 700;
          color: var(--brand-navy);
          text-decoration: none;
          backdrop-filter: blur(10px);
          box-shadow: var(--shadow-glass);
          transition: all 0.25s ease;
        }
        .btn-glass:hover {
          background: #ffffff;
          transform: translateY(-2px);
          border-color: var(--brand-purple);
        }

        .hero-right {
          position: relative;
          z-index: 10;
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 44px;
        }

        .clay-widget {
          background: rgba(255, 255, 255, 0.85);
          backdrop-filter: blur(20px);
          border-radius: 24px;
          padding: 16px;
          display: flex;
          align-items: center;
          gap: 18px;
          box-shadow: var(--shadow-glass), var(--shadow-light);
          border: 1px solid rgba(255, 255, 255, 0.9);
          width: 320px;
          cursor: pointer;
          transition: transform 0.2s;
        }
        .clay-widget:hover {
          transform: translateY(-3px);
        }

        .widget-img {
          width: 85px;
          height: 85px;
          background: linear-gradient(135deg, var(--brand-navy) 0%, var(--brand-purple) 100%);
          border-radius: 18px;
          display: flex;
          justify-content: center;
          align-items: center;
          box-shadow: var(--shadow-dark);
          flex-shrink: 0;
        }

        .widget-info {
          flex: 1;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          height: 80px;
        }

        .w-top {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
        }
        .w-title {
          font-size: 14px;
          font-weight: 700;
          line-height: 1.25;
          color: var(--brand-navy);
        }
        .w-dot {
          width: 8px;
          height: 8px;
          background: var(--brand-pink);
          border-radius: 50%;
        }

        .w-bottom {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .w-line {
          height: 3px;
          background: rgba(139, 120, 198, 0.15);
          width: 60px;
          border-radius: 2px;
          position: relative;
        }
        .w-line::after {
          content: "";
          position: absolute;
          left: 0;
          top: 0;
          height: 100%;
          width: 70%;
          background: var(--brand-purple);
          border-radius: 2px;
        }
        .w-controls {
          display: flex;
          gap: 6px;
        }
        .w-ctrl {
          width: 24px;
          height: 24px;
          background: rgba(139, 120, 198, 0.1);
          color: var(--brand-purple);
          border-radius: 50%;
          display: flex;
          justify-content: center;
          align-items: center;
          font-size: 11px;
          font-weight: 800;
        }

        .partners {
          text-align: right;
          max-width: 300px;
        }
        .p-label {
          font-size: 11px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: var(--text-muted);
          margin-bottom: 10px;
        }
        .p-logos {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          justify-content: flex-end;
        }
        .p-logos span {
          background: rgba(255, 255, 255, 0.75);
          border: 1px solid rgba(139, 120, 198, 0.2);
          padding: 4px 10px;
          border-radius: 12px;
          font-size: 11px;
          font-weight: 700;
          color: var(--brand-navy);
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.02);
        }

        .hero-footer {
          position: absolute;
          bottom: 0;
          left: 0;
          width: 100%;
          height: 50px;
          background: linear-gradient(to top, rgba(29, 30, 60, 0.06), transparent);
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0 48px 10px;
          color: var(--text-muted);
          font-size: 11px;
          font-weight: 600;
          z-index: 15;
        }

        /* Bottom Section */
        .bottom-section {
          background-color: var(--bg-bottom);
          border-top-left-radius: 40px;
          border-top-right-radius: 40px;
          position: relative;
          z-index: 20;
          padding: 80px 48px;
          margin-top: -30px;
          box-shadow: 0 -20px 40px rgba(29, 30, 60, 0.04);
          display: flex;
          flex-direction: column;
          align-items: center;
          overflow: hidden;
        }

        .wireframe-globe {
          position: absolute;
          top: 0;
          left: -10vw;
          width: 700px;
          height: 700px;
          opacity: 0.03;
          pointer-events: none;
          z-index: 0;
          background-image: radial-gradient(circle, transparent 40%, #1D1E3C 41%, transparent 42%),
            linear-gradient(0deg, transparent 49%, #1D1E3C 50%, transparent 51%),
            linear-gradient(90deg, transparent 49%, #1D1E3C 50%, transparent 51%);
          background-size: 100% 100%, 50px 50px, 50px 50px;
          border-radius: 50%;
          transform: perspective(600px) rotateX(60deg) translateY(-20%);
        }

        .s2-content {
          display: flex;
          justify-content: space-between;
          width: 100%;
          max-width: 1200px;
          position: relative;
          z-index: 10;
          gap: 40px;
        }

        .s2-left {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 48px;
        }
        .about-label {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 12px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: var(--brand-purple);
        }
        .about-label .dot {
          width: 8px;
          height: 8px;
          background: var(--brand-pink);
          border-radius: 50%;
        }

        .hub-info {
          display: flex;
          align-items: center;
          gap: 14px;
          font-size: 12px;
          font-weight: 600;
          color: var(--text-muted);
          max-width: 250px;
          line-height: 1.5;
        }
        .hub-info svg {
          width: 32px;
          height: 32px;
          stroke: var(--brand-purple);
          fill: none;
          stroke-width: 1.5;
          flex-shrink: 0;
        }

        .s2-right {
          flex: 1.3;
          display: flex;
          flex-direction: column;
          gap: 40px;
        }

        .s2-right h2 {
          font-size: clamp(24px, 3.2vw, 38px);
          font-weight: 500;
          line-height: 1.25;
          letter-spacing: -1px;
          color: var(--brand-navy);
        }
        .s2-right h2 span {
          color: var(--brand-purple);
        }

        .social-bar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 16px;
        }

        .s-icons {
          display: flex;
          gap: 10px;
          align-items: center;
        }
        .s-label {
          font-size: 11px;
          font-weight: 700;
          color: var(--text-muted);
          margin-right: 8px;
        }
        .s-icon {
          width: 34px;
          height: 34px;
          border-radius: 50%;
          background: #EAE8F2;
          color: var(--brand-navy);
          display: flex;
          justify-content: center;
          align-items: center;
          font-size: 11px;
          font-weight: bold;
          text-decoration: none;
          transition: transform 0.2s;
        }
        .s-icon:hover {
          transform: translateY(-2px);
        }
        .s-icon.purple {
          background: var(--brand-purple);
          color: white;
        }
        .s-icon.pink {
          background: var(--brand-pink);
          color: white;
        }

        .about-btn {
          font-size: 13px;
          font-weight: 800;
          color: var(--brand-navy);
          text-decoration: none;
          display: flex;
          align-items: center;
          gap: 6px;
          transition: gap 0.2s;
        }
        .about-btn:hover {
          gap: 10px;
          color: var(--brand-purple);
        }

        /* 3D Giant Clay Pills */
        .pill-container {
          display: flex;
          justify-content: center;
          gap: 18px;
          margin-top: 80px;
          position: relative;
          z-index: 10;
          width: 100%;
          max-width: 1050px;
          flex-wrap: wrap;
        }

        .giant-pill {
          flex: 1;
          min-width: 170px;
          height: 100px;
          border-radius: 50px;
          display: flex;
          justify-content: center;
          align-items: center;
          font-size: 22px;
          font-weight: 700;
          cursor: pointer;
          transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
          border: 2px solid transparent;
          user-select: none;
        }
        .giant-pill:hover {
          transform: translateY(-6px) scale(1.02);
        }

        .pill-white {
          background: var(--bg-bottom);
          box-shadow: var(--shadow-light);
          border-color: rgba(255, 255, 255, 0.9);
          color: var(--brand-navy);
        }

        .pill-purple {
          background: var(--brand-purple);
          box-shadow: var(--shadow-purple);
          color: white;
          border-color: rgba(255, 255, 255, 0.3);
        }

        .pill-pink {
          background: var(--brand-pink);
          box-shadow: var(--shadow-pink);
          color: white;
          border-color: rgba(255, 255, 255, 0.3);
        }

        .pill-black {
          background: var(--brand-navy);
          box-shadow: var(--shadow-dark);
          color: white;
          border-color: rgba(255, 255, 255, 0.15);
        }

        /* Responsive */
        @media (max-width: 1100px) {
          .hero {
            flex-direction: column;
            justify-content: flex-start;
            align-items: flex-start;
            padding-top: 100px;
            min-height: auto;
            padding-bottom: 80px;
          }
          .hero-img-wrap {
            position: relative;
            left: auto;
            bottom: auto;
            transform: none;
            width: 100%;
            height: 45vh;
            margin: 25px 0;
          }
          .hero-right {
            width: 100%;
            align-items: flex-start;
            flex-direction: row;
            justify-content: space-between;
            flex-wrap: wrap;
            gap: 24px;
          }
          .partners {
            text-align: left;
          }
          .p-logos {
            justify-content: flex-start;
          }
          .bg-text {
            font-size: 26vw;
            bottom: 30%;
          }
        }

        @media (max-width: 768px) {
          .hero {
            padding: 80px 20px 50px;
          }
          .bottom-section {
            padding: 60px 20px;
          }
          .s2-content {
            flex-direction: column;
            gap: 36px;
          }
          .hero-footer {
            display: none;
          }
          .giant-pill {
            min-width: 130px;
            height: 80px;
            font-size: 18px;
          }
        }
      `}</style>
    </div>
  );
}