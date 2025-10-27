import React, { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

export default function Home() {
  const navigate = typeof window !== 'undefined' ? useNavigate() : null;
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const target = token ? "/editor" : "/login";
  const label = token ? "Open Editor" : "Get started";

  const heroRef = useRef(null);
  const videoRefA = useRef(null);
  const videoRefB = useRef(null);
  const sectionVideoRefs = useRef({});
  // sample data for sections
  const sampleData = {
    interior: [
      { id: 'int-1', title: 'Cozy Living Room', date: 'Feb 12, 2025', img: '/assets/interior1.svg', desc: 'A warm living room concept focusing on natural materials and daylight.' },
      { id: 'int-2', title: 'Kitchen Concept', date: 'Jan 28, 2025', img: '/assets/interior1.svg', desc: 'Open-plan kitchen with integrated storage and island.' },
      { id: 'int-3', title: 'Bedroom Suite', date: 'Dec 10, 2024', img: '/assets/interior1.svg', desc: 'Minimal bedroom suite with soft textiles and ambient lighting.' }
    ],
    exterior: [
      { id: 'ext-1', title: 'Facade Proposal', date: 'Mar 03, 2025', img: '/assets/exterior1.svg', desc: 'A ventilated facade strategy using layered materials.' },
      { id: 'ext-2', title: 'Landscape Integration', date: 'Feb 14, 2025', img: '/assets/exterior1.svg', desc: 'Terraced planting and rainwater strategies for the site.' },
      { id: 'ext-3', title: 'Night Rendering', date: 'Nov 21, 2024', img: '/assets/exterior1.svg', desc: 'Night-time lighting proposal showing warmth and depth.' }
    ],
    culture: [
      { id: 'cul-1', title: 'Community Workshop', date: 'Apr 02, 2025', img: '/assets/culture1.svg', desc: 'Participatory design workshop notes and diagrams.' },
      { id: 'cul-2', title: 'Research Note', date: 'Jan 11, 2025', img: '/assets/culture1.svg', desc: 'Research findings on local materials and crafts.' },
      { id: 'cul-3', title: 'Public Installation', date: 'Oct 15, 2024', img: '/assets/culture1.svg', desc: 'Proposal for a temporary public installation.' }
    ]
  };

  const [selectedItem, setSelectedItem] = useState(null);
  const [videoLoaded, setVideoLoaded] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeLayer, setActiveLayer] = useState(0); // 0 = A visible, 1 = B visible

  // helper: respect prefers-reduced-motion
  const prefersReducedMotion = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Video playlist with explicit public path
  const playlist = [
    './public/assets/hero-house1.mp4',
    './public/assets/hero-house2.mp4',
    './public/assets/hero-house3.mp4'
  ];

  // Rotation state ref to access latest from any closure
  const rotationTimerRef = useRef(null);
  const currentIndexRef = useRef(0);
  const [activeSection, setActiveSection] = useState(0);

  // helper to set a source on a video element and return a promise when loaded
  const setVideoSource = (vidEl, src) => {
    return new Promise((resolve) => {
      if (!vidEl) return resolve();
      try {
        vidEl.pause();
        // remove all sources then add new
        while (vidEl.firstChild) vidEl.removeChild(vidEl.firstChild);
        const s = document.createElement('source');
        s.src = src;
        s.type = 'video/mp4';
        vidEl.appendChild(s);
        vidEl.load();
        const onCan = () => { vidEl.removeEventListener('canplay', onCan); resolve(); };
        vidEl.addEventListener('canplay', onCan);
      } catch (err) {
        // If something goes wrong, resolve to avoid blocking
        console.error('setVideoSource error', err);
        resolve();
      }
    });
  };

  // Start video rotation
  const startRotation = () => {
    if (prefersReducedMotion) return;
    
    const stopRotation = () => { 
      if (rotationTimerRef.current) { 
        clearInterval(rotationTimerRef.current); 
        rotationTimerRef.current = null; 
      } 
    };

    stopRotation();
    let currentLayer = activeLayer;
    
    rotationTimerRef.current = setInterval(() => {
      const videoA = videoRefA.current;
      const videoB = videoRefB.current;
      if (!videoA || !videoB) return;

      // Toggle between layers
      const nextLayer = currentLayer === 0 ? 1 : 0;
      const hiddenVid = nextLayer === 0 ? videoA : videoB;
      const visibleVid = nextLayer === 0 ? videoB : videoA;
      
      // Start playing the hidden video
      try {
        hiddenVid.currentTime = 0;
        hiddenVid.play().then(() => {
          // After play starts, update the visibility
          setActiveLayer(nextLayer);
          currentLayer = nextLayer;
          // Optionally pause the previously visible video
          visibleVid.pause();
        }).catch(e => {
          console.error('Failed to play video:', e);
        });
      } catch (e) {
        console.error('Video transition error:', e);
      }
    }, 12000);
  };

  useEffect(() => {
  const hero = heroRef.current;
  const videoA = videoRefA.current;
  const videoB = videoRefB.current;
  if (!hero) return;

  let io;

    // helper to set a source on a video element and return a promise when loaded
    const setVideoSource = (vidEl, src) => {
      return new Promise((resolve) => {
        if (!vidEl) return resolve();
        vidEl.pause();
        // remove all sources then add new
        while (vidEl.firstChild) vidEl.removeChild(vidEl.firstChild);
        const s = document.createElement('source');
        s.src = src;
        s.type = 'video/mp4';
        vidEl.appendChild(s);
        vidEl.load();
        const onCan = () => { vidEl.removeEventListener('canplay', onCan); resolve(); };
        vidEl.addEventListener('canplay', onCan);
      });
    };

    // rotation logic: crossfade between two video layers
    // Video rotation control functions
    const stopRotation = () => { 
      if (rotationTimerRef.current) { 
        clearInterval(rotationTimerRef.current); 
        rotationTimerRef.current = null; 
      } 
    };

    const loadVideo = async () => {
      if (videoLoaded) return;
      // load first into A, second into B preloaded
      await setVideoSource(videoA, playlist[0]);
      if (!prefersReducedMotion) await setVideoSource(videoB, playlist[1 % playlist.length]);
      setVideoLoaded(true);
      if (!prefersReducedMotion) {
        try { 
          await videoA.play(); 
          setIsPlaying(true); 
        } catch(e) {
          console.error('Failed to play initial video:', e);
        }
      }
      currentIndexRef.current = 0;
      // start rotation if allowed
      if (!prefersReducedMotion && isPlaying) startRotation();
    };

    if (prefersReducedMotion) {
      // load poster only (still set first video source but don't autoplay or rotate)
      (async () => {
        await setVideoSource(videoA, playlist[0]);
        setVideoLoaded(true);
      })();
    } else if ('IntersectionObserver' in window) {
      io = new IntersectionObserver((entries) => {
        entries.forEach(e => {
          if (e.isIntersecting) {
            loadVideo();
            if (io) io.disconnect();
          }
        });
      }, { threshold: 0.25 });
      io.observe(hero);
    } else {
      // fallback: load immediately
      loadVideo();
    }

    // Parallax mouse move for blobs and slight video movement
  let raf = null;
    const blobs = hero.querySelectorAll('.hero-blob');
    const onMove = (ev) => {
      const rect = hero.getBoundingClientRect();
      const x = (ev.clientX - rect.left) / rect.width - 0.5;
      const y = (ev.clientY - rect.top) / rect.height - 0.5;
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        // video translate
        if (videoA) videoA.style.transform = `translate3d(${x * 6}px, ${y * 6}px, 0) scale(1.02)`;
        if (videoB) videoB.style.transform = `translate3d(${x * 6}px, ${y * 6}px, 0) scale(1.02)`;
        blobs.forEach((b, i) => {
          const depth = (i + 1) * 6;
          b.style.transform = `translate3d(${x * depth}px, ${y * depth}px, 0)`;
        });
      });
    };
    if (!prefersReducedMotion) {
      hero.addEventListener('mousemove', onMove);
      hero.addEventListener('touchmove', onMove, { passive: true });
    }

    // Entrance animations using Web Animations API (respect reduced-motion)
    if (!prefersReducedMotion) {
      const title = hero.querySelector('.hero-title');
      const ctas = hero.querySelectorAll('.hero-cta-row > *');
      if (title && title.animate) {
        title.animate([{ opacity: 0, transform: 'translateY(18px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 700, easing: 'cubic-bezier(.2,.9,.3,1)', fill: 'forwards' });
      }
      if (ctas && ctas.length && ctas[0].animate) {
        ctas.forEach((el, idx) => el.animate([{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 600, delay: 220 + idx * 80, fill: 'forwards' }));
      }
    }

    

    return () => {
      if (io) io.disconnect();
      if (raf) cancelAnimationFrame(raf);
      if (!prefersReducedMotion) {
        hero.removeEventListener('mousemove', onMove);
        hero.removeEventListener('touchmove', onMove);
      }
      stopRotation();
    };
  }, [videoLoaded, prefersReducedMotion]);

  // Play/pause section background videos depending on which section is active
  useEffect(() => {
    // mapping of section idx to ids used earlier: 0=hero (we keep hero videos), 1=interior, 2=exterior, 3=culture
    const map = {
      1: 'interior',
      2: 'exterior',
      3: 'culture'
    };

    // pause all section videos first
    Object.values(sectionVideoRefs.current).forEach((v) => {
      try { if (v && !v.paused) v.pause(); } catch (e) { /* ignore */ }
    });

    const id = map[activeSection];
    if (id) {
      const vid = sectionVideoRefs.current[id];
      if (vid) {
        // try play (muted automatically to allow autoplay)
        vid.currentTime = 0;
        vid.play().catch(() => { /* autoplay blocked or missing file */ });
      }
    }
  }, [activeSection]);

  // Generate small placeholder WebM videos at runtime (canvas -> MediaRecorder)
  useEffect(() => {
    if (typeof window === 'undefined' || !window.MediaRecorder || !window.OffscreenCanvas && !document.createElement) return;

    const createDemoVideo = async (w = 640, h = 360, colors = ['#8b5e45', '#f7d9c7'], duration = 2000) => {
      return new Promise((resolve) => {
        // create a canvas
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');

        const stream = canvas.captureStream(30);
        const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9' });
        const chunks = [];
        recorder.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
        recorder.onstop = () => {
          const blob = new Blob(chunks, { type: 'video/webm' });
          const url = URL.createObjectURL(blob);
          resolve(url);
        };

        // simple animated gradient
        let start = null;
        const draw = (t) => {
          if (!start) start = t;
          const p = ((t - start) % 2000) / 2000;
          // interpolate colors
          const c1 = colors[0];
          const c2 = colors[1];
          const grad = ctx.createLinearGradient(0, 0, w, h);
          grad.addColorStop(0, c1);
          grad.addColorStop(1, c2);
          ctx.fillStyle = grad;
          ctx.fillRect(0, 0, w, h);
          // moving shapes
          ctx.fillStyle = 'rgba(255,255,255,0.08)';
          const x = Math.sin((t - start) / 600) * (w * 0.06);
          ctx.beginPath();
          ctx.ellipse(w * 0.2 + x, h * 0.35, w * 0.16, h * 0.12, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.beginPath();
          ctx.ellipse(w * 0.75 - x, h * 0.6, w * 0.22, h * 0.16, 0, 0, Math.PI * 2);
          ctx.fill();
          if (!recorder.state || recorder.state === 'recording') requestAnimationFrame(draw);
        };

        recorder.start();
        requestAnimationFrame(draw);
        setTimeout(() => {
          try { recorder.stop(); } catch (e) { resolve(null); }
        }, duration + 60);
      });
    };

    // generate for each section if not already present
    const genAll = async () => {
      const map = {
        interior: ['#8b5e45', '#f7d9c7'],
        exterior: ['#6b3e26', '#eef2f3'],
        culture: ['#f7d9c7', '#fff8f2']
      };
      for (const key of Object.keys(map)) {
        const el = sectionVideoRefs.current[key];
        if (!el) continue;
        // if video has no src (or only poster), generate a runtime webm
        const hasSource = el.currentSrc || (el.querySelector && el.querySelector('source') && el.querySelector('source').src);
        if (!hasSource) {
          try {
            const url = await createDemoVideo(960, 540, map[key], 2000);
            if (url) {
              // assign blob url directly to video
              el.src = url;
              el.load();
            }
          } catch (e) {
            // ignore generation errors
            console.warn('Demo video generation failed', e);
          }
        }
      }
    };

    genAll();
  }, []);

  // play/pause toggle with rotation handling
  const togglePlay = async () => {
    const a = videoRefA.current;
    const b = videoRefB.current;
    if (!a && !b) return;

    const anyPlaying = (a && !a.paused) || (b && !b.paused);
    if (anyPlaying) {
      // Pause both videos and clear rotation
      if (a) a.pause();
      if (b) b.pause();
      setIsPlaying(false);
      // Add paused class for visual feedback
      a?.classList.add('paused');
      b?.classList.add('paused');
    } else {
      // Remove paused classes
      a?.classList.remove('paused');
      b?.classList.remove('paused');
      // Try to play the active layer first
      const toPlay = activeLayer === 0 ? a || b : b || a;
      if (toPlay) {
        try {
          await toPlay.play();
          setIsPlaying(true);
          // Restart rotation if successful
          startRotation();
        } catch (err) {
          console.error('Failed to play video:', err);
          setIsPlaying(false);
        }
      }
    }
  };

  // side dots scroll handler
  const handleDotClick = (idx) => {
    if (typeof window === 'undefined') return;
    const ids = ['hero-section', 'interior', 'exterior', 'culture'];
    const id = ids[idx] || ids[0];
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      // fallback: scroll by viewport multiples
      const y = Math.round(idx * window.innerHeight);
      window.scrollTo({ top: y, behavior: 'smooth' });
    }
  };

  // Scrollspy: update active side-dot while scrolling
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const ids = ['hero-section', 'interior', 'exterior', 'culture'];
    const getEls = () => ids.map(id => document.getElementById(id));

    let els = getEls();

    const onScroll = () => {
      const center = window.innerHeight / 2;
      let bestIdx = 0;
      let bestDist = Infinity;
      els.forEach((el, i) => {
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const elCenter = rect.top + rect.height / 2;
        const dist = Math.abs(elCenter - center);
        if (dist < bestDist) {
          bestDist = dist;
          bestIdx = i;
        }
      });
      setActiveSection(bestIdx);
    };

    // initial run
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);

    // If content changes, refresh list (basic observer)
    const mo = new MutationObserver(() => { els = getEls(); });
    mo.observe(document.body, { childList: true, subtree: true });

    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      mo.disconnect();
    };
  }, []);

  // modal close on ESC
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') setSelectedItem(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div style={{ position: 'relative', minHeight: '100vh' }}>
  {/* Fixed button group (Day17 dashboard actions) */}
  <div style={{ position: 'fixed', top: 16, right: 16, display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end', zIndex: 1000 }}>
        <button
          onClick={() => navigate('/dashboard')}
          className="btn-soft"
        >
          Open Dashboard
        </button>
        <button
          onClick={() => {
            const id = prompt('Enter projectId to load:');
            if (id) {
              localStorage.setItem('loadedProjectId', id);
              window.location.href = '/editor';
            }
          }}
          className="btn-soft"
        >
          Load projectId
        </button>
        <button
          onClick={() => {
            localStorage.removeItem('token');
            localStorage.removeItem('username');
            window.location.href = '/login';
          }}
          className="btn-soft"
        >
          Logout
        </button>
        <button onClick={() => alert('Day17 • Projects & Dashboard\n\nHelp: Use the buttons to manage your projects.')} className="btn-soft">Help</button>
      </div>

  <div id="hero-section" className="hero-bg" ref={heroRef}>
        {/* Top nav - minimal */}
        <header className="top-nav" aria-hidden="false">
          <div className="logo">DreamHouse</div>
          <div style={{display: 'flex', gap: 12, alignItems: 'center'}}>
            <div style={{color: 'rgba(255,255,255,0.8)', fontSize: 14}}>EN</div>
            <button className="menu-btn" aria-label="open menu">☰</button>
          </div>
        </header>

        {/* Two layered videos for crossfade rotation */}
        <video 
          ref={videoRefA} 
          className={`hero-video-layer ${activeLayer === 0 ? 'visible' : ''}`} 
          preload="none" 
          muted 
          loop 
          playsInline 
          poster="./public/assets/hero-poster.jpg" 
          style={{opacity: activeLayer === 0 ? 1 : 0}}
          aria-hidden="true"
        >
          <source src="./public/assets/hero-house1.mp4" type="video/mp4" />
        </video>
        <video 
          ref={videoRefB} 
          className={`hero-video-layer ${activeLayer === 1 ? 'visible' : ''}`} 
          preload="none" 
          muted 
          loop 
          playsInline 
          poster="./public/assets/hero-poster.jpg"
          style={{opacity: activeLayer === 1 ? 1 : 0}}
          aria-hidden="true"
        >
          <source src="./public/assets/hero-house2.mp4" type="video/mp4" />
        </video>

        {/* play/pause control (overlay) */}
        <button className="video-toggle" onClick={togglePlay} aria-label={isPlaying ? 'Pause background' : 'Play background'}>{isPlaying ? '❚❚' : '▶'}</button>

        {/* dark overlay to match high-contrast aesthetic */}
        <div className="hero-overlay" aria-hidden="true"></div>

        <div className="hero-gradient" aria-hidden="true"></div>
        <div className="hero-blob shape-1" aria-hidden="true"></div>
        <div className="hero-blob shape-2" aria-hidden="true"></div>
        <div className="hero-blob shape-3" aria-hidden="true"></div>
        <div className="bg-shape s1" aria-hidden="true"></div>
        <div className="bg-shape s2" aria-hidden="true"></div>
        <div className="bg-shape s3" aria-hidden="true"></div>

        <div className="hero-content">
          <div className="p-8 hero-card" style={{ maxWidth: 1200 }}>
            <div style={{display: 'flex', gap: 48, alignItems: 'flex-start'}}>
              <div className="hero-left" style={{flex: 1}}>
                <h1 className="hero-title">Design for a changing world</h1>
                <p className="hero-subtitle" style={{marginTop: 8}}>We make architecture, interiors, urbanism, and research that is innovative, social, green, realistic, and remarkable.</p>
                <div className="hero-cta-row">
                  <Link to={target} className="btn-coffee">{label}</Link>
                  <Link to="/extras" className="btn-coffee-ghost">Explore projects</Link>
                </div>
              </div>
              {/* Optional right content area - keep empty to mimic large left headline */}
              <div style={{width: 320}} aria-hidden="true"></div>
            </div>
          </div>
        </div>

        {/* Right side dot navigation */}
        <div className="side-dots" aria-hidden="false">
          <button className={activeSection === 0 ? 'active' : ''} aria-label="Top / Hero" onClick={() => handleDotClick(0)}></button>
          <button className={activeSection === 1 ? 'active' : ''} aria-label="Interior" onClick={() => handleDotClick(1)}></button>
          <button className={activeSection === 2 ? 'active' : ''} aria-label="Exterior" onClick={() => handleDotClick(2)}></button>
          <button className={activeSection === 3 ? 'active' : ''} aria-label="Culture" onClick={() => handleDotClick(3)}></button>
        </div>
      </div>
      {/* Additional full-screen sections for scroll navigation */}
      <section id="interior" className="card" style={{ minHeight: '100vh', padding: 48, position: 'relative', overflow: 'hidden' }}>
        <video
          ref={(el) => (sectionVideoRefs.current['interior'] = el)}
          className="section-video"
          muted
          loop
          playsInline
          preload="metadata"
          poster="/assets/interior1.svg"
          aria-hidden="true"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', zIndex: 0, pointerEvents: 'none', filter: 'brightness(0.6) saturate(0.9)' }}
        >
          <source src="/assets/interior.mp4" type="video/mp4" />
        </video>
        <h2 style={{ fontSize: 28, marginBottom: 12 }}>Interior</h2>
        <p className="muted">Explore interior layouts, materials, and finishes. Scroll to see the active dot change.</p>
        <div style={{ marginTop: 24, position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px,1fr))', gap: 16 }}>
            {sampleData.interior.map(item => (
              <article key={item.id} className="card" style={{ padding: 12, cursor: 'pointer' }} onClick={() => setSelectedItem({ ...item, section: 'interior' })}>
                <img src={item.img} alt={item.title} style={{ width: '100%', borderRadius: 8 }} />
                <h3 style={{ marginTop: 10, marginBottom: 4 }}>{item.title}</h3>
                <div className="small-muted">{item.date}</div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="exterior" className="card" style={{ minHeight: '100vh', padding: 48, position: 'relative', overflow: 'hidden' }}>
        <video
          ref={(el) => (sectionVideoRefs.current['exterior'] = el)}
          className="section-video"
          muted
          loop
          playsInline
          preload="metadata"
          poster="/assets/exterior1.svg"
          aria-hidden="true"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', zIndex: 0, pointerEvents: 'none', filter: 'brightness(0.6) saturate(0.9)' }}
        >
          <source src="/assets/exterior.mp4" type="video/mp4" />
        </video>
        <h2 style={{ fontSize: 28, marginBottom: 12 }}>Exterior</h2>
        <p className="muted">Exterior studies, facades, and landscape interactions.</p>
        <div style={{ marginTop: 24, position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px,1fr))', gap: 16 }}>
            {sampleData.exterior.map(item => (
              <article key={item.id} className="card" style={{ padding: 12, cursor: 'pointer' }} onClick={() => setSelectedItem({ ...item, section: 'exterior' })}>
                <img src={item.img} alt={item.title} style={{ width: '100%', borderRadius: 8 }} />
                <h3 style={{ marginTop: 10, marginBottom: 4 }}>{item.title}</h3>
                <div className="small-muted">{item.date}</div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="culture" className="card" style={{ minHeight: '100vh', padding: 48, position: 'relative', overflow: 'hidden' }}>
        <video
          ref={(el) => (sectionVideoRefs.current['culture'] = el)}
          className="section-video"
          muted
          loop
          playsInline
          preload="metadata"
          poster="/assets/culture1.svg"
          aria-hidden="true"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', zIndex: 0, pointerEvents: 'none', filter: 'brightness(0.6) saturate(0.9)' }}
        >
          <source src="/assets/culture.mp4" type="video/mp4" />
        </video>
        <h2 style={{ fontSize: 28, marginBottom: 12 }}>Culture</h2>
        <p className="muted">Research, culture, and community insights.</p>
        <div style={{ marginTop: 24, position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px,1fr))', gap: 16 }}>
            {sampleData.culture.map(item => (
              <article key={item.id} className="card" style={{ padding: 12, cursor: 'pointer' }} onClick={() => setSelectedItem({ ...item, section: 'culture' })}>
                <img src={item.img} alt={item.title} style={{ width: '100%', borderRadius: 8 }} />
                <h3 style={{ marginTop: 10, marginBottom: 4 }}>{item.title}</h3>
                <div className="small-muted">{item.date}</div>
              </article>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
