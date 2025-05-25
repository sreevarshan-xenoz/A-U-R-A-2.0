import dynamic from 'next/dynamic';
import Head from 'next/head';
import { useState, useEffect } from 'react';

// Import the Chat component
import Chat from '../components/Chat';
import Scene1 from '../components/Scene1';
import Scene2 from '../components/Scene2';
import ThemeToggle from '../components/ThemeToggle';

// Dynamically import Spline components to avoid SSR issues
const Scene1 = dynamic(() => import('../components/Scene1'), { ssr: false });
const Scene2 = dynamic(() => import('../components/Scene2'), { ssr: false });

export default function Home() {
  const [activeScene, setActiveScene] = useState(1);

  const toggleScene = () => {
    setActiveScene(activeScene === 1 ? 2 : 1);
  };

  return (
    <div className="container">
      <Head>
        <title>A-U-R-A AI Assistant</title>
        <meta name="description" content="Advanced AI assistant with 3D visualization" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className="main">
        <div className="scene-container">
          <div className={`scene-overlay first-scene ${activeScene === 1 ? 'active' : 'inactive'}`}>
            <Scene1 />
          </div>
          <div className={`scene-overlay second-scene ${activeScene === 2 ? 'active' : 'inactive'}`}>
            <Scene2 />
          </div>
          <button className="scene-toggle-button" onClick={toggleScene}>
            Switch Scene
          </button>
        </div>
        
        <div className="chat-wrapper">
          <div className="header">
            <h1 className="title">A-U-R-A</h1>
            <p className="description">Advanced AI Assistant</p>
            <ThemeToggle />
          </div>
          <Chat />
        </div>
      </main>

      <footer className="footer">
        <p>Powered by A-U-R-A AI</p>
      </footer>
    </div>
  );
} 