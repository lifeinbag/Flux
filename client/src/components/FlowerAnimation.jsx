import React, { useEffect, useRef, useState } from 'react';

const FlowerAnimation = ({ show = false, style = {} }) => {
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const particlesRef = useRef([]);
  const [isHovered, setIsHovered] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    if (!show) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    
    // Set canvas size
    const setCanvasSize = () => {
      if (isExpanded) {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
      } else {
        canvas.width = 400;
        canvas.height = 400;
      }
    };
    
    setCanvasSize();
    window.addEventListener('resize', setCanvasSize);

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;

    // Simplified Particle class
    class Particle {
      constructor(expanded = false) {
        this.baseAngle = Math.random() * Math.PI * 2;
        this.noiseOffset = Math.random() * 1000;
        this.reset(expanded);
      }

      reset(expanded = false) {
        this.angle = this.baseAngle;
        this.radius = Math.random() * 20 + 5;
        this.maxRadius = expanded ? Math.random() * 300 + 150 : Math.random() * 120 + 60;
        this.speed = Math.random() * 0.8 + 0.3;
        this.size = Math.random() * 1.5 + 0.8;
        this.opacity = 0;
        this.life = 0;
        this.maxLife = Math.random() * 200 + 100;
        
        // Flower parameters
        this.petalCount = 6;
        this.petalAmplitude = Math.random() * 30 + 15;
        this.rotationSpeed = (Math.random() - 0.5) * 0.02;
        this.pulseSpeed = Math.random() * 0.05 + 0.02;
        this.colorHue = Math.random() * 60 + 180;
      }

      update(time, expanded = false) {
        this.life++;
        
        // Life cycle
        if (this.life < 30) {
          this.opacity = this.life / 30;
        } else if (this.life > this.maxLife - 30) {
          this.opacity = (this.maxLife - this.life) / 30;
        } else {
          this.opacity = 0.8 + Math.sin(time * this.pulseSpeed) * 0.2;
        }

        // Movement
        this.radius += this.speed * (0.8 + Math.sin(time * 0.01) * 0.4);
        this.angle += this.rotationSpeed + Math.sin(time * 0.003 + this.noiseOffset) * 0.01;

        // Flower petal effect
        const petalNoise = Math.sin(this.angle * this.petalCount + time * 0.01) * this.petalAmplitude;
        const breathingEffect = Math.sin(time * 0.005 + this.noiseOffset) * 10;
        this.currentRadius = this.radius + petalNoise + breathingEffect;

        // Size variation
        this.currentSize = this.size * (1 + Math.sin(time * 0.02 + this.noiseOffset) * 0.3);

        // Reset if needed
        if (this.life >= this.maxLife || this.currentRadius > this.maxRadius) {
          this.reset(expanded);
        }
      }

      draw(ctx, time, centerX, centerY) {
        if (this.opacity <= 0) return;

        const x = centerX + Math.cos(this.angle) * this.currentRadius;
        const y = centerY + Math.sin(this.angle) * this.currentRadius;

        ctx.save();
        ctx.globalAlpha = this.opacity;
        
        // Simple color system
        const intensity = Math.sin(time * 0.01 + this.noiseOffset) * 0.3 + 0.7;
        const r = Math.round(100 + intensity * 155);
        const g = Math.round(150 + intensity * 105);
        const b = Math.round(200 + intensity * 55);
        
        // Create gradient
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, this.currentSize * 3);
        gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${this.opacity})`);
        gradient.addColorStop(0.5, `rgba(${r * 0.8}, ${g * 0.9}, ${b}, ${this.opacity * 0.6})`);
        gradient.addColorStop(1, `rgba(${r * 0.5}, ${g * 0.7}, ${b * 0.9}, 0)`);

        ctx.fillStyle = gradient;
        ctx.shadowColor = `rgba(${r}, ${g}, ${b}, ${this.opacity * 0.5})`;
        ctx.shadowBlur = this.currentSize * 2;
        
        ctx.beginPath();
        ctx.arc(x, y, this.currentSize, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.restore();
      }
    }

    // Initialize particles
    const particleCount = isExpanded ? 200 : 150;
    particlesRef.current = [];
    
    for (let i = 0; i < particleCount; i++) {
      particlesRef.current.push(new Particle(isExpanded));
    }

    // Animation loop
    const animate = (time) => {
      const currentCenterX = canvas.width / 2;
      const currentCenterY = canvas.height / 2;
      
      // Clear with trail effect
      ctx.fillStyle = 'rgba(0, 0, 0, 0.08)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Update and draw particles
      particlesRef.current.forEach(particle => {
        particle.update(time * 0.01, isExpanded);
        particle.draw(ctx, time * 0.01, currentCenterX, currentCenterY);
      });

      // Center glow
      const coreRadius = 40 + Math.sin(time * 0.003) * 10;
      const coreGradient = ctx.createRadialGradient(currentCenterX, currentCenterY, 0, currentCenterX, currentCenterY, coreRadius);
      
      coreGradient.addColorStop(0, 'rgba(200, 220, 255, 0.15)');
      coreGradient.addColorStop(0.5, 'rgba(150, 180, 255, 0.1)');
      coreGradient.addColorStop(1, 'rgba(100, 150, 255, 0)');
      
      ctx.fillStyle = coreGradient;
      ctx.fillRect(currentCenterX - coreRadius, currentCenterY - coreRadius, coreRadius * 2, coreRadius * 2);

      if (show) {
        animationRef.current = requestAnimationFrame(animate);
      }
    };

    animate(0);

    return () => {
      window.removeEventListener('resize', setCanvasSize);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [show, isExpanded]);

  const handleMouseEnter = () => {
    setIsHovered(true);
    setTimeout(() => setIsExpanded(true), 100);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    setTimeout(() => setIsExpanded(false), 200);
  };

  if (!show) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        background: isExpanded ? 'rgba(0, 0, 0, 0.95)' : 'rgba(0, 0, 0, 0.8)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backdropFilter: isExpanded ? 'blur(8px)' : 'blur(4px)',
        transition: 'all 0.5s ease',
        ...style
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div 
        style={{ 
          position: 'relative', 
          textAlign: 'center',
          transform: isExpanded ? 'scale(1.2)' : 'scale(1)',
          transition: 'transform 0.5s ease'
        }}
      >
        <canvas
          ref={canvasRef}
          style={{
            width: isExpanded ? '600px' : '400px',
            height: isExpanded ? '600px' : '400px',
            borderRadius: isExpanded ? '10px' : '50%',
            background: 'transparent',
            transition: 'all 0.5s ease',
            cursor: 'pointer'
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: isExpanded ? '-80px' : '-60px',
            left: '50%',
            transform: 'translateX(-50%)',
            color: 'white',
            fontSize: isExpanded ? '24px' : '18px',
            fontWeight: '600',
            textShadow: '0 4px 8px rgba(0, 0, 0, 0.7)',
            animation: 'linkingPulse 2s infinite',
            transition: 'all 0.5s ease'
          }}
        >
          {isExpanded ? '✨ Linking Your Trading Accounts ✨' : 'Linking Accounts...'}
        </div>
      </div>
    </div>
  );
};

export default FlowerAnimation;