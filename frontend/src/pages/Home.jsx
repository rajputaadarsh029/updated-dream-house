import React, { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import ThreeDViewer from '../components/ThreeDViewer';

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
      { id: 'int-1', title: 'Modern Living Room', date: 'Feb 12, 2025', img: 'https://images.unsplash.com/photo-1618219944342-824e40a13285', desc: 'A bright and airy living room with contemporary furniture and large windows for natural light.' },
      { id: 'int-2', title: 'Luxury Kitchen', date: 'Jan 28, 2025', img: 'https://images.unsplash.com/photo-1556911220-bff31c812dba', desc: 'Elegant kitchen design with marble countertops, modern appliances, and custom cabinetry.' },
      { id: 'int-3', title: 'Master Suite', date: 'Dec 10, 2024', img: 'https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af', desc: 'Serene master bedroom featuring neutral tones, custom lighting, and panoramic views.' }
    ],
    exterior: [
      { id: 'ext-1', title: 'Modern Facade', date: 'Mar 03, 2025', img: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c', desc: 'Contemporary home exterior with clean lines, large windows, and sustainable materials.' },
      { id: 'ext-2', title: 'Garden Design', date: 'Feb 14, 2025', img: 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6', desc: 'Sustainable landscape design integrating native plants and water-efficient features.' },
      { id: 'ext-3', title: 'Evening View', date: 'Nov 21, 2024', img: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750', desc: 'Stunning dusk view showcasing architectural lighting and indoor-outdoor connection.' }
    ],
    culture: [
      { id: 'cul-1', title: 'Community Design Hub', date: 'Apr 02, 2025', img: 'https://images.unsplash.com/photo-1517502884422-41eaead166d4', desc: 'Our innovative community workspace where architects and residents collaborate on sustainable solutions.' },
      { id: 'cul-2', title: 'Local Craftsmanship', date: 'Jan 11, 2025', img: 'https://images.unsplash.com/photo-1503387762-592deb58ef4e', desc: 'Integrating traditional craftsmanship with modern architectural techniques.' },
      { id: 'cul-3', title: 'Urban Integration', date: 'Oct 15, 2024', img: 'https://images.unsplash.com/photo-1519999482648-25049ddd37b1', desc: 'Exploring how architecture can enhance community connections and urban life.' }
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

  // State for 3D viewer
  const [show3DViewer, setShow3DViewer] = useState(false);
  const [activeModel, setActiveModel] = useState(null);

  // Small reusable slideshow component (crossfade) for section highlights
  function Slideshow({ images = [], interval = 3000, height = 320 }) {
    const [frontIdx, setFrontIdx] = useState(0);
    const [backIdx, setBackIdx] = useState(images && images.length ? images.length - 1 : 0);
    const [showFront, setShowFront] = useState(true);
    const timerRef = useRef(null);

    useEffect(() => {
      if (!images || images.length <= 1) return;

      timerRef.current = setInterval(() => {
        setFrontIdx((prev) => {
          const next = (prev + 1) % images.length;
          // update back to previous index
          setBackIdx(prev);
          // toggle which layer is visible
          setShowFront((s) => !s);
          return next;
        });
      }, interval);

      return () => {
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
      };
    }, [images, interval]);

    const frontSrc = images && images[frontIdx] ? images[frontIdx].img : '';
    const backSrc = images && images[backIdx] ? images[backIdx].img : '';

    return (
      <div style={{ position: 'relative', width: '100%', height, borderRadius: 12, overflow: 'hidden', marginBottom: 20 }}>
        <img
          src={backSrc}
          alt="back"
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            transition: 'opacity 600ms ease',
            opacity: showFront ? 0 : 1,
            transform: 'scale(1.02)'
          }}
        />
        <img
          src={frontSrc}
          alt="front"
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            transition: 'opacity 600ms ease',
            opacity: showFront ? 1 : 0,
            transform: 'scale(1.02)'
          }}
        />
        {/* overlay title */}
        {images && images[frontIdx] && (
          <div style={{ position: 'absolute', left: 20, bottom: 18, color: '#fff', textShadow: '0 2px 8px rgba(0,0,0,0.6)' }}>
            <div style={{ fontSize: 18, fontWeight: 700 }}>{images[frontIdx].title}</div>
            <div style={{ fontSize: 13, opacity: 0.9 }}>{images[frontIdx].date}</div>
          </div>
        )}
      </div>
    );
  }

  // Handle 3D model viewer open
  const open3DViewer = (modelPath) => {
    setActiveModel(modelPath);
    setShow3DViewer(true);
    // Store the model path for the editor
    localStorage.setItem('lastViewedModel', modelPath);
  };

  return (
    <div style={{ position: 'relative', minHeight: '100vh' }}>
      {/* Modal for item details */}
      {selectedItem && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0,0,0,0.75)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: 32
        }}>
          <div style={{
            backgroundColor: '#fff',
            borderRadius: 16,
            maxWidth: 1000,
            width: '100%',
            maxHeight: '90vh',
            overflow: 'auto',
            position: 'relative'
          }}>
            <button
              onClick={() => setSelectedItem(null)}
              style={{
                position: 'absolute',
                top: 16,
                right: 16,
                background: 'none',
                border: 'none',
                fontSize: 24,
                cursor: 'pointer',
                zIndex: 1
              }}
            >
              ×
            </button>
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              <div style={{ position: 'relative', paddingTop: '56.25%' }}>
                <img
                  src={selectedItem.img}
                  alt={selectedItem.title}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover'
                  }}
                />
              </div>
              <div style={{ padding: 32 }}>
                <h2 style={{ fontSize: 28, marginBottom: 16 }}>{selectedItem.title}</h2>
                <p style={{ fontSize: 16, color: '#666', marginBottom: 24 }}>{selectedItem.desc}</p>
                
                {selectedItem.specs && (
                  <div style={{ marginBottom: 32 }}>
                    <h3 style={{ fontSize: 20, marginBottom: 16 }}>Specifications</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 24 }}>
                      <div>
                        <h4 style={{ fontSize: 16, color: '#888', marginBottom: 8 }}>Dimensions</h4>
                        <p>Area: {selectedItem.specs.area}</p>
                        <p>Height: {selectedItem.specs.height}</p>
                      </div>
                      <div>
                        <h4 style={{ fontSize: 16, color: '#888', marginBottom: 8 }}>Style & Materials</h4>
                        <p>Style: {selectedItem.specs.style}</p>
                        <p>Materials: {selectedItem.specs.materials.join(', ')}</p>
                      </div>
                      <div>
                        <h4 style={{ fontSize: 16, color: '#888', marginBottom: 8 }}>Features</h4>
                        <ul style={{ paddingLeft: 20 }}>
                          {selectedItem.specs.features.map((feature, idx) => (
                            <li key={idx}>{feature}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                )}
                
                  {/* 3D Viewer Modal */}
                  {show3DViewer && activeModel && (
                    <div style={{
                      position: 'fixed',
                      inset: 0,
                      backgroundColor: 'rgba(0,0,0,0.85)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      zIndex: 2000
                    }}>
                      <div style={{
                        width: '90vw',
                        height: '90vh',
                        position: 'relative',
                        background: '#000',
                        borderRadius: 16,
                        overflow: 'hidden'
                      }}>
                        <button
                          onClick={() => {
                            setShow3DViewer(false);
                            setActiveModel(null);
                          }}
                          style={{
                            position: 'absolute',
                            top: 16,
                            right: 16,
                            background: 'rgba(255,255,255,0.1)',
                            border: 'none',
                            color: '#fff',
                            borderRadius: '50%',
                            width: 40,
                            height: 40,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            zIndex: 1
                          }}
                        >
                          ×
                        </button>
                        <ThreeDViewer modelPath={activeModel} />
                      </div>
                    </div>
                  )}
                <div style={{ display: 'flex', gap: 16, marginTop: 32 }}>
                  <button
                    onClick={() => open3DViewer(selectedItem && selectedItem.section ? `demo-${selectedItem.section}` : 'demo')}
                    className="btn-soft"
                  >
                    Demo 3D
                  </button>
                  {selectedItem.model3D && (
                    <button
                      onClick={() => open3DViewer(selectedItem.model3D)}
                      className="btn-coffee"
                    >
                      View in 3D
                    </button>
                  )}
                  <button
                    onClick={() => {
                      localStorage.setItem('selectedDesign', selectedItem.id);
                      navigate('/editor');
                    }}
                    className="btn-coffee-ghost"
                  >
                    Open in Editor
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
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
      <section id="interior" className="card" style={{ minHeight: '100vh', padding: 48, position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
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
        <div style={{ position: 'relative', zIndex: 1 }}>
          <h2 style={{ fontSize: 36, marginBottom: 16, color: '#fff' }}>Interior Design</h2>
          <p className="muted" style={{ fontSize: 18, maxWidth: 600, marginBottom: 32 }}>Explore our curated collection of interior spaces. Click any design to view the 3D walkthrough and detailed specifications.</p>
          <Slideshow images={sampleData.interior} interval={3000} height={320} />
        </div>
        <div style={{ flex: 1, position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center' }}>
          <div style={{ width: '100%', maxWidth: 1200, margin: '0 auto' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24 }}>
              {sampleData.interior.map(item => (
                <article 
                  key={item.id} 
                  className="card hover-card" 
                  style={{ 
                    padding: 0, 
                    cursor: 'pointer',
                    background: '#fff',
                    borderRadius: 12,
                    overflow: 'hidden',
                    transition: 'transform 0.2s ease-in-out',
                    boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                    height: '100%'
                  }}
                  onClick={() => setSelectedItem({ 
                    ...item, 
                    section: 'interior',
                    model3D: `/models/${item.id}.glb`, // 3D model path
                    specs: {
                      area: '120 m²',
                      height: '2.8m',
                      style: 'Contemporary',
                      materials: ['Natural Wood', 'Marble', 'Glass'],
                      lighting: 'LED Ambient + Natural',
                      features: ['Smart Home Integration', 'Sustainable Materials', 'Optimal Flow']
                    }
                  })}
                >
                  <div style={{ position: 'relative', paddingTop: '75%', overflow: 'hidden' }}>
                    <img 
                      src={item.img} 
                      alt={item.title} 
                      style={{ 
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover'
                      }} 
                    />
                  </div>
                  <div style={{ padding: 20 }}>
                    <h3 style={{ fontSize: 20, marginBottom: 8, color: '#333' }}>{item.title}</h3>
                    <p style={{ fontSize: 14, color: '#666', marginBottom: 12 }}>{item.desc}</p>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div className="small-muted">{item.date}</div>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <button
                          onClick={(e) => { e.stopPropagation(); open3DViewer('demo-interior'); }}
                          className="btn-soft"
                          style={{ fontSize: 12, padding: '6px 8px' }}
                        >
                          Demo 3D
                        </button>
                        <div style={{ color: '#8b5e45', fontSize: 14 }}>View 3D ↗</div>
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="exterior" className="card" style={{ minHeight: '100vh', padding: 48, position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
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
        <div style={{ position: 'relative', zIndex: 1 }}>
          <h2 style={{ fontSize: 36, marginBottom: 16, color: '#fff' }}>Exterior Design</h2>
          <p className="muted" style={{ fontSize: 18, maxWidth: 600, marginBottom: 32 }}>Discover our architectural facades and landscape designs. Experience each project in immersive 3D.</p>
          <Slideshow images={sampleData.exterior} interval={3000} height={320} />
        </div>
        <div style={{ flex: 1, position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center' }}>
          <div style={{ width: '100%', maxWidth: 1200, margin: '0 auto' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24 }}>
              {sampleData.exterior.map(item => (
                <article 
                  key={item.id} 
                  className="card hover-card" 
                  style={{ 
                    padding: 0, 
                    cursor: 'pointer',
                    background: '#fff',
                    borderRadius: 12,
                    overflow: 'hidden',
                    transition: 'transform 0.2s ease-in-out',
                    boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                    height: '100%'
                  }}
                  onClick={() => setSelectedItem({ 
                    ...item, 
                    section: 'exterior',
                    model3D: `/models/${item.id}.glb`, // 3D model path
                    specs: {
                      area: item.id === 'ext-1' ? '450 m²' : item.id === 'ext-2' ? '850 m²' : '650 m²',
                      height: item.id === 'ext-1' ? '12m' : item.id === 'ext-2' ? '4m' : '15m',
                      style: item.id === 'ext-1' ? 'Modern Minimalist' : item.id === 'ext-2' ? 'Sustainable Garden' : 'Contemporary',
                      materials: item.id === 'ext-1' ? 
                        ['Steel', 'Glass', 'Concrete'] : 
                        item.id === 'ext-2' ? 
                        ['Natural Stone', 'Sustainable Wood', 'Native Plants'] :
                        ['Glass', 'Steel', 'LED Lighting'],
                      lighting: item.id === 'ext-1' ? 'Natural + LED Accent' : item.id === 'ext-2' ? 'Solar Garden Lights' : 'Dynamic LED System',
                      features: item.id === 'ext-1' ? 
                        ['Double-Height Windows', 'Solar Panels', 'Green Roof'] :
                        item.id === 'ext-2' ? 
                        ['Rain Water Harvesting', 'Native Landscaping', 'Meditation Areas'] :
                        ['Smart Lighting', 'Infinity Pool', 'Panoramic Views']
                    }
                  })}
                >
                  <div style={{ position: 'relative', paddingTop: '75%', overflow: 'hidden' }}>
                    <img 
                      src={item.img} 
                      alt={item.title} 
                      style={{ 
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover'
                      }} 
                    />
                  </div>
                  <div style={{ padding: 20 }}>
                    <h3 style={{ fontSize: 20, marginBottom: 8, color: '#333' }}>{item.title}</h3>
                    <p style={{ fontSize: 14, color: '#666', marginBottom: 12 }}>{item.desc}</p>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div className="small-muted">{item.date}</div>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <button
                          onClick={(e) => { e.stopPropagation(); open3DViewer('demo-exterior'); }}
                          className="btn-soft"
                          style={{ fontSize: 12, padding: '6px 8px' }}
                        >
                          Demo 3D
                        </button>
                        <div style={{ color: '#8b5e45', fontSize: 14 }}>View 3D ↗</div>
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="culture" className="card" style={{ minHeight: '100vh', padding: 48, position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
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
        <div style={{ position: 'relative', zIndex: 1 }}>
          <h2 style={{ fontSize: 36, marginBottom: 16, color: '#fff' }}>Cultural Integration</h2>
          <p className="muted" style={{ fontSize: 18, maxWidth: 600, marginBottom: 32 }}>Experience how our designs integrate with communities and cultural contexts through interactive 3D spaces.</p>
          <Slideshow images={sampleData.culture} interval={3000} height={320} />
        </div>
        <div style={{ flex: 1, position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center' }}>
          <div style={{ width: '100%', maxWidth: 1200, margin: '0 auto' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24 }}>
              {sampleData.culture.map(item => (
                <article 
                  key={item.id} 
                  className="card hover-card" 
                  style={{ 
                    padding: 0, 
                    cursor: 'pointer',
                    background: '#fff',
                    borderRadius: 12,
                    overflow: 'hidden',
                    transition: 'transform 0.2s ease-in-out',
                    boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                    height: '100%'
                  }}
                  onClick={() => setSelectedItem({ 
                    ...item, 
                    section: 'culture',
                    model3D: `/models/${item.id}.glb`, // 3D model path
                    specs: {
                      area: item.id === 'cul-1' ? '300 m²' : item.id === 'cul-2' ? '180 m²' : '500 m²',
                      height: item.id === 'cul-1' ? '4.5m' : item.id === 'cul-2' ? '3.8m' : '12m',
                      style: item.id === 'cul-1' ? 'Community Space' : item.id === 'cul-2' ? 'Workshop Studio' : 'Urban Plaza',
                      materials: item.id === 'cul-1' ? 
                        ['Reclaimed Wood', 'Local Stone', 'Glass'] : 
                        item.id === 'cul-2' ? 
                        ['Traditional Materials', 'Handcrafted Elements', 'Natural Textiles'] :
                        ['Urban Materials', 'Interactive Surfaces', 'Green Elements'],
                      lighting: item.id === 'cul-1' ? 'Natural + Adjustable LED' : item.id === 'cul-2' ? 'Task + Ambient' : 'Dynamic Urban Lighting',
                      features: item.id === 'cul-1' ? 
                        ['Flexible Space', 'Digital Integration', 'Community Kitchen'] :
                        item.id === 'cul-2' ? 
                        ['Craft Stations', 'Material Library', 'Exhibition Space'] :
                        ['Public Gathering', 'Cultural Events', 'Interactive Art']
                    }
                  })}
                >
                  <div style={{ position: 'relative', paddingTop: '75%', overflow: 'hidden' }}>
                    <img 
                      src={item.img} 
                      alt={item.title} 
                      style={{ 
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover'
                      }} 
                    />
                  </div>
                  <div style={{ padding: 20 }}>
                    <h3 style={{ fontSize: 20, marginBottom: 8, color: '#333' }}>{item.title}</h3>
                    <p style={{ fontSize: 14, color: '#666', marginBottom: 12 }}>{item.desc}</p>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div className="small-muted">{item.date}</div>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <button
                          onClick={(e) => { e.stopPropagation(); open3DViewer('demo-culture'); }}
                          className="btn-soft"
                          style={{ fontSize: 12, padding: '6px 8px' }}
                        >
                          Demo 3D
                        </button>
                        <div style={{ color: '#8b5e45', fontSize: 14 }}>View 3D ↗</div>
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
