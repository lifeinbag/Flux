import React, { useEffect, useRef, useState } from 'react';

const DollarRain = ({ show = false, duration = 5000, onComplete, style = {} }) => {
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const dollarsRef = useRef([]);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (show) {
      setIsVisible(true);
      // Auto-hide after duration
      const timer = setTimeout(() => {
        setIsVisible(false);
        if (onComplete) {
          onComplete();
        }
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [show, duration, onComplete]);

  useEffect(() => {
    if (!isVisible) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    
    // Load dollar bill image
    const dollarImage = new Image();
    dollarImage.crossOrigin = 'anonymous';
    
    const startAnimation = () => {
      // Set canvas size
      const setCanvasSize = () => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
      };
      
      setCanvasSize();
      window.addEventListener('resize', setCanvasSize);

    // Simple Dollar bill class
    class Dollar {
      constructor() {
        this.reset();
      }

      reset() {
        this.x = Math.random() * canvas.width;
        this.y = -50 - Math.random() * 200; // Start above screen
        this.speed = Math.random() * 1.5 + 0.8; // Slower falling speed
        this.rotationSpeed = (Math.random() - 0.5) * 0.03;
        this.rotation = Math.random() * Math.PI * 2;
        this.sway = Math.random() * 0.5 + 0.2; // Less sway
        this.swayOffset = Math.random() * Math.PI * 2;
        this.size = Math.random() * 0.3 + 0.7; // Better size range
        this.opacity = Math.random() * 0.4 + 0.6; // Much more visible (60-100%)
        
        // Bill dimensions (larger and more realistic)
        this.width = 50 * this.size;
        this.height = 22 * this.size;
      }

      update() {
        // Falling motion
        this.y += this.speed;
        
        // Gentle horizontal sway
        this.x += Math.sin(this.y * 0.005 + this.swayOffset) * this.sway;
        
        // Slow rotation
        this.rotation += this.rotationSpeed;
        
        // Wrap around screen horizontally
        if (this.x < -this.width) {
          this.x = canvas.width + this.width;
        } else if (this.x > canvas.width + this.width) {
          this.x = -this.width;
        }
        
        // Reset when off screen (bottom)
        if (this.y > canvas.height + 50) {
          this.reset();
        }
      }

      draw(ctx, image) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);
        ctx.globalAlpha = this.opacity;
        
        // Draw the dollar bill image
        if (image && image.complete) {
          ctx.drawImage(
            image,
            -this.width/2,
            -this.height/2,
            this.width,
            this.height
          );
        } else {
          // Fallback: draw a simple green rectangle if image fails to load
          ctx.fillStyle = '#32CD32';
          ctx.fillRect(-this.width/2, -this.height/2, this.width, this.height);
          ctx.strokeStyle = '#006400';
          ctx.lineWidth = 1;
          ctx.strokeRect(-this.width/2, -this.height/2, this.width, this.height);
          
          // Add $ symbol as fallback
          ctx.fillStyle = '#006400';
          ctx.font = `bold ${12 * this.size}px Arial`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('$', 0, 0);
        }
        
        ctx.restore();
      }
    }

      // Initialize dollars
      const dollarCount = 20; // Good balance of visibility
      dollarsRef.current = [];
      
      for (let i = 0; i < dollarCount; i++) {
        dollarsRef.current.push(new Dollar());
      }

      // Animation loop
      const animate = () => {
        // Clear canvas completely each frame
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Update and draw dollars
        dollarsRef.current.forEach(dollar => {
          dollar.update();
          dollar.draw(ctx, dollarImage);
        });

        if (isVisible) {
          animationRef.current = requestAnimationFrame(animate);
        }
      };

      animate();

      return () => {
        window.removeEventListener('resize', setCanvasSize);
        if (animationRef.current) {
          cancelAnimationFrame(animationRef.current);
        }
      };
    };

    // Load the dollar image and start animation
    dollarImage.onload = startAnimation;
    dollarImage.onerror = () => {
      console.warn('Dollar bill image failed to load, using fallback');
      startAnimation(); // Start anyway with fallback
    };
    dollarImage.src = '/Dollar.jpg';

  }, [isVisible]);

  if (!isVisible) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 1, // Very low z-index so it stays behind content
        pointerEvents: 'none', // Allow clicks through
        ...style
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          width: '100%',
          height: '100%',
          background: 'transparent'
        }}
      />
    </div>
  );
};

export default DollarRain;