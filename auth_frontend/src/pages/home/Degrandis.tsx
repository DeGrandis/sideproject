// import { useEffect, useRef, useState } from 'react'
import '../../assets/styles/App.css'
import '../../assets/styles/degrandis.css'
import { SharedFooter } from '../../layouts/footer'; // Adjust the import path as needed

function Degrandis() {


  return (
    <>
      <div className='app-container'>
        <div className='app-top'>
          
        </div>
        <div className='app-middle'>
          <div className='logo-text'>
            <h1>DEGRAND.IS</h1>
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
