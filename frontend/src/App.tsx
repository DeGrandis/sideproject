import { useEffect, useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'

interface helloResponse {
  data: {
    message: string 
  }
}

// const backendUrl =  "http://sideproject.biblestudycraft.com/api/"

function App() {
  const [count, setCount] = useState(0)
  const [response, setData] = useState<helloResponse | null>(null)
  useEffect(() => {
    const fetchData = async () => {
      const response = await fetch('http://sideproject.biblestudycraft.com/api/hello')
      const data = await response.json()
      console.log(data)
      setData(data)
    }
    fetchData()
  }, [])  

  return (
    <>
      <div>
        <a href="https://vite.dev" target="_blank">
          <img src={viteLogo} className="logo" alt="Vite logo" />
        </a>
        <a href="https://react.dev" target="_blank">
          <img src={reactLogo} className="logo react" alt="React logo" />
        </a>
      </div>
      <h1>Vite + React</h1>
      <div className="card">
        <button onClick={() => setCount((count) => count + 1)}>
          count is {count}
        </button>
        <p>
          {response ? response.data.message : 'Loading...'}


        </p>
      </div>
      <p className="read-the-docs">
        Click on the Vite and React logos to learn more
      </p>
    </>
  )
}

export default App
