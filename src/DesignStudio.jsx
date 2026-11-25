import React, { useEffect, useRef, useState } from 'react';

const fabrics = [
  { color: '#7a263f', en: 'Garnet', bn: 'গারনেট' },
  { color: '#e8dfcb', en: 'Ivory', bn: 'আইভরি' },
  { color: '#542034', en: 'Wine', bn: 'ওয়াইন' },
  { color: '#2f4a6b', en: 'Midnight blue', bn: 'গাঢ় নীল' },
  { color: '#697653', en: 'Olive', bn: 'অলিভ' },
];

const words = {
  en: { title: 'Design your Panjabi', intro: 'Shape the details and turn your idea into a clear order brief.', fabric: 'Fabric', sleeve: 'Sleeve', collar: 'Collar', buttons: 'Buttons', full: 'Full', half: 'Half', band: 'Band', round: 'Round', gold: 'Gold', ivory: 'Ivory', drag: 'Drag the garment to rotate it', attach: 'Use this design in an order', fallback: '3D preview is unavailable here. Your design choices are still saved.' },
  bn: { title: 'আপনার পাঞ্জাবির নকশা করুন', intro: 'বিস্তারিত বেছে নিয়ে আপনার ভাবনাকে অর্ডারের স্পষ্ট বিবরণে রূপ দিন।', fabric: 'কাপড়', sleeve: 'হাতা', collar: 'কলার', buttons: 'বোতাম', full: 'লম্বা', half: 'ছোট', band: 'ব্যান্ড', round: 'গোল', gold: 'সোনালি', ivory: 'আইভরি', drag: 'ঘুরিয়ে দেখতে পোশাকটি টেনে ধরুন', attach: 'এই নকশা দিয়ে অর্ডার করুন', fallback: 'এখানে ৩ডি প্রিভিউ পাওয়া যাচ্ছে না। আপনার নকশার পছন্দ সংরক্ষিত থাকবে।' },
};

export default function DesignStudio({ language, onUseDesign }) {
  const [fabric, setFabric] = useState(fabrics[0].color);
  const [sleeve, setSleeve] = useState('full');
  const [collar, setCollar] = useState('band');
  const [buttons, setButtons] = useState('gold');
  const viewport = useRef(null);
  const copy = words[language];

  useEffect(() => {
    const THREE = window.THREE;
    const host = viewport.current;
    if (!host) return undefined;
    if (!THREE) {
      host.innerHTML = `<div class="studio-fallback"><svg viewBox="0 0 240 280" role="img" aria-label="Panjabi preview"><path d="M75 42 96 32h48l21 10 34 24-19 38-19-10v143H79V94l-19 10-19-38z" fill="${fabric}" stroke="#4b1a2e" stroke-width="4"/><path d="M101 34q19 30 38 0M120 60v105" fill="none" stroke="${buttons === 'gold' ? '#d8b27a' : '#f8f3ea'}" stroke-width="8" stroke-linecap="round"/><path d="M81 225q39 18 78 0" fill="none" stroke="#d8b27a" stroke-width="3" stroke-dasharray="4 6"/></svg><p>${copy.fallback}</p></div>`;
      return undefined;
    }

    let renderer;
    let frame = 0;
    let dragging = false;
    let previousX = 0;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 50);
    camera.position.set(0, 0.15, 6.4);
    const group = new THREE.Group();
    scene.add(group);
    scene.add(new THREE.AmbientLight(0xffffff, 1.15));
    const key = new THREE.DirectionalLight(0xfff0e4, 1.3);
    key.position.set(3, 4, 5);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xd7e4ff, 0.38);
    fill.position.set(-3, 1, -4);
    scene.add(fill);

    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setClearColor(0xffffff, 0);
      host.replaceChildren(renderer.domElement);

      const cloth = new THREE.MeshStandardMaterial({ color: fabric, roughness: 0.82, side: THREE.DoubleSide });
      const trim = new THREE.MeshStandardMaterial({ color: buttons === 'gold' ? '#d8b27a' : '#f8f3ea', metalness: buttons === 'gold' ? 0.45 : 0.05, roughness: 0.4 });
      const bodyShape = [[0.17, 1.3], [0.4, 1.22], [0.5, 0.95], [0.5, 0.4], [0.56, -0.4], [0.65, -1.25]].map(([radius, height]) => new THREE.Vector2(radius, height));
      const body = new THREE.Mesh(new THREE.LatheGeometry(bodyShape, 48), cloth);
      body.scale.z = 0.62;
      body.position.y = -0.1;
      group.add(body);

      const sleeveLength = sleeve === 'full' ? 1.25 : 0.68;
      [-1, 1].forEach(side => {
        const sleeveMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.12, sleeveLength, 24, 1, true), cloth);
        sleeveMesh.geometry.translate(0, -sleeveLength / 2, 0);
        sleeveMesh.position.set(side * 0.44, 1, 0);
        sleeveMesh.rotation.z = side * 0.3;
        group.add(sleeveMesh);
      });

      if (collar === 'band') {
        const collarMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.13, 32, 1, true), cloth);
        collarMesh.position.y = 1.2;
        group.add(collarMesh);
      } else {
        const collarMesh = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.025, 10, 32), trim);
        collarMesh.rotation.x = Math.PI / 2;
        collarMesh.position.y = 1.17;
        group.add(collarMesh);
      }

      const placket = new THREE.Mesh(new THREE.BoxGeometry(0.055, 1.1, 0.025), trim);
      placket.position.set(0, 0.58, 0.335);
      group.add(placket);
      for (let index = 0; index < 6; index += 1) {
        const button = new THREE.Mesh(new THREE.SphereGeometry(0.038, 14, 14), trim);
        button.position.set(0, 1 - index * 0.17, 0.355);
        group.add(button);
      }

      const resize = () => {
        const width = host.clientWidth || 1;
        const height = host.clientHeight || 1;
        renderer.setSize(width, height);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
      };
      const observer = new ResizeObserver(resize);
      observer.observe(host);
      resize();

      const pointerDown = event => { dragging = true; previousX = event.clientX; host.setPointerCapture?.(event.pointerId); };
      const pointerMove = event => {
        if (!dragging) return;
        group.rotation.y += (event.clientX - previousX) * 0.012;
        previousX = event.clientX;
      };
      const pointerUp = () => { dragging = false; };
      host.addEventListener('pointerdown', pointerDown);
      host.addEventListener('pointermove', pointerMove);
      host.addEventListener('pointerup', pointerUp);
      host.addEventListener('pointercancel', pointerUp);

      const render = time => {
        frame = requestAnimationFrame(render);
        if (!dragging) group.rotation.y = Math.sin(time / 3400) * 0.13;
        group.position.y = Math.sin(time / 900) * 0.035;
        renderer.render(scene, camera);
      };
      frame = requestAnimationFrame(render);

      return () => {
        cancelAnimationFrame(frame);
        observer.disconnect();
        host.removeEventListener('pointerdown', pointerDown);
        host.removeEventListener('pointermove', pointerMove);
        host.removeEventListener('pointerup', pointerUp);
        host.removeEventListener('pointercancel', pointerUp);
        scene.traverse(object => {
          object.geometry?.dispose();
          if (Array.isArray(object.material)) object.material.forEach(material => material.dispose());
          else object.material?.dispose();
        });
        renderer.dispose();
      };
    } catch {
      host.innerHTML = `<div class="studio-fallback"><svg viewBox="0 0 240 280" role="img" aria-label="Panjabi preview"><path d="M75 42 96 32h48l21 10 34 24-19 38-19-10v143H79V94l-19 10-19-38z" fill="${fabric}" stroke="#4b1a2e" stroke-width="4"/><path d="M101 34q19 30 38 0M120 60v105" fill="none" stroke="${buttons === 'gold' ? '#d8b27a' : '#f8f3ea'}" stroke-width="8" stroke-linecap="round"/><path d="M81 225q39 18 78 0" fill="none" stroke="#d8b27a" stroke-width="3" stroke-dasharray="4 6"/></svg><p>${copy.fallback}</p></div>`;
    }
    return undefined;
  }, [fabric, sleeve, collar, buttons, copy.fallback]);

  const design = () => ({ fabric, sleeve, collar, buttons, label: `${fabrics.find(item => item.color === fabric)?.[language] || fabrics[0][language]}, ${copy[sleeve]} sleeve, ${copy[collar]} collar, ${copy[buttons]} buttons` });

  return <section className="design-studio-panel">
    <header className="design-studio-heading"><div><span className="studio-kicker">E-DORJI · DESIGN STUDIO</span><h2>{copy.title}</h2><p>{copy.intro}</p></div><span className="studio-live-pill">3D · LIVE</span></header>
    <div className="design-studio-layout">
      <div className="studio-preview-column"><div className="studio-preview" ref={viewport} aria-label={copy.drag}/><p className="studio-drag-hint"><span aria-hidden="true">⟳</span>{copy.drag}</p></div>
      <div className="studio-controls">
        <div className="studio-control"><h3>{copy.fabric}</h3><div className="studio-swatches">{fabrics.map(option => <button type="button" key={option.color} className="studio-swatch" style={{ background: option.color }} aria-label={option[language]} aria-pressed={fabric === option.color} onClick={() => setFabric(option.color)} />)}</div><p className="studio-selected-fabric">{fabrics.find(option => option.color === fabric)?.[language]}</p></div>
        <div className="studio-control"><h3>{copy.sleeve}</h3><div className="studio-segmented"><button type="button" aria-pressed={sleeve === 'full'} onClick={() => setSleeve('full')}>{copy.full}</button><button type="button" aria-pressed={sleeve === 'half'} onClick={() => setSleeve('half')}>{copy.half}</button></div></div>
        <div className="studio-control"><h3>{copy.collar}</h3><div className="studio-segmented"><button type="button" aria-pressed={collar === 'band'} onClick={() => setCollar('band')}>{copy.band}</button><button type="button" aria-pressed={collar === 'round'} onClick={() => setCollar('round')}>{copy.round}</button></div></div>
        <div className="studio-control"><h3>{copy.buttons}</h3><div className="studio-segmented"><button type="button" aria-pressed={buttons === 'gold'} onClick={() => setButtons('gold')}>{copy.gold}</button><button type="button" aria-pressed={buttons === 'ivory'} onClick={() => setButtons('ivory')}>{copy.ivory}</button></div></div>
        <button className="dash-primary studio-attach" type="button" onClick={() => onUseDesign(design())}>{copy.attach} →</button>
      </div>
    </div>
  </section>;
}
