import { signInWithPopup } from 'firebase/auth'
import React from 'react'
import { auth, googleprovider } from '../utils/firebase'
import api from '../utils/axios'

const App = () => {

  const handleLogin = async (token) => {
    try {
      const { data } = await api.post("/auth/login", { token })
      console.log(data)
    }
    catch (error) {
      console.log(error)
    }
  }
  const googleLogin = async () => {
    try {
      const data = await signInWithPopup(auth, googleprovider)
      const token = await data.user.getIdToken()
      console.log(token)
      await handleLogin(token)
      console.log(data)
    } catch (error) {
      console.log(error)
    }
  }
  return (
    <div className='font-bold bg-amber-500 justify-center'>
      <button className='w-50 h-50 bg-amber-900' onClick={googleLogin}>
        continue with Google
      </button>
    </div>
  )
}

export default App