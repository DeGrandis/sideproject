// import { useEffect, useRef, useState } from 'react'
import { useEffect, useState } from 'react';
import '../../assets/styles/App.css'
import '../../assets/styles/degrandis.css'
import { SharedFooter } from '../../layouts/footer'; // Adjust the import path as needed
import Header from 'src/layouts/header';
const texts = ["auth", "api", "budget", "invoices", "mempool", "video", "anything", "everything"];


function Degrandis() {
  const [index, setIndex] = useState(0);
  const [prevIndex, setPrevIndex] = useState<number | null>(null);
  const [animating, setAnimating] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setPrevIndex(index);
      setIndex((prev) => (prev + 1) % texts.length);
      setAnimating(true);
      setTimeout(() => setAnimating(false), 500); // match animation duration
    }, 2000);
    return () => clearInterval(interval);
  }, [index]);

  return (
    <>
      <div className='app-container'>
        <div className='app-top'>
          <Header></Header>
        </div>

        <div className='app-middle'>
          <div className='logo-text'>
            <div className="scroll-domain-center-row">
              <span className="scroll-wheel-container">
                {prevIndex !== null && animating && (
                  <span key={prevIndex} className="scroll-wheel-text scroll-wheel-out">
                    {texts[prevIndex]}
                  </span>
                )}
                <span
                  key={index}
                  className={
                    "scroll-wheel-text" +
                    (animating ? " scroll-wheel-in" : "")
                  }
                >
                  {texts[index]}
                </span>
              </span>
              <span className="static-domain-center">.degrand.is</span>
            </div>
          </div>
        </div>
        <div className='app-bottom'>
          <SharedFooter />
        </div>
      </div>
    </>
  )
}

export default Degrandis
