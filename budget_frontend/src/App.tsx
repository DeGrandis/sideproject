import { useEffect, useState } from 'react'
import './App.css'
// import EntryBox from './components/EntryBox.tsx'
import constructionGif from './assets/underconstruction.gif'
import constructionGif2 from './assets/underconstruction2.gif'

// interface Entry {
//   value1: string;
//   value2: string;
// }

function App() {

  const [flash, setFlash] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setFlash(f => !f);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // const [entries, setEntries] = useState<Entry[]>([
  //   { value1: '', value2: '' },
  //   { value1: '', value2: '' }
  // ]);

  // const handleChange = (index: number, field: 'value1' | 'value2', value: string) => {
  //   setEntries(prev =>
  //     prev.map((entry, i) =>
  //       i === index ? { ...entry, [field]: value } : entry
  //     )
  //   );
  //   console.log(entries)
  // };

  // const handleAdd = () => {
  //   setEntries(prev => [...prev, { value1: '', value2: '' }]);
  // };

  return (
    <>
      {/* <div>
        {entries.map((entry, idx) => (
          <EntryBox
            key={idx}
            value1={entry.value1}
            value2={entry.value2}
            onChange1={e => handleChange(idx, 'value1', e.target.value)}
            onChange2={e => handleChange(idx, 'value2', e.target.value)}
          />
        ))}
        <button onClick={handleAdd}>Add</button>
      </div> */}

      <div className='app-container'>
        <img className='construction' src={constructionGif2} alt="" />

        <h1>          <span className={flash ? 'flash' : ''}>budget</span>.degrand.is</h1>
        <img className='construction' src={constructionGif} alt="" />
      </div>
    </>
  )
}

export default App
