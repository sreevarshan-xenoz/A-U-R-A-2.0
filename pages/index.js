import dynamic from 'next/dynamic';
import Head from 'next/head';

// Import the Chat component
import Chat from '../components/Chat';

// Dynamically import Spline components to avoid SSR issues
const Scene1 = dynamic(() => import('../components/Scene1'), { ssr: false });
const Scene2 = dynamic(() => import('../components/Scene2'), { ssr: false });

export default function Home() {
  return (
    <div className="container">
      <Head>
        <title>A-U-R-A | AI Assistant</title>
        <meta name="description" content="A-U-R-A is an advanced AI assistant with cutting-edge capabilities" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className="main">
        <div className="scene-container">
          <div className="scene-overlay first-scene">
            <Scene1 />
          </div>
          <div className="scene-overlay second-scene">
            <Scene2 />
          </div>
          
          <div className="chat-overlay">
            <Chat />
          </div>
        </div>
      </main>
    </div>
  );
} 