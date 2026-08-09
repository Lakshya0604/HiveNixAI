import React, { useEffect } from 'react'

import getCurrentUser from './features/getCurrentUser'
import { useDispatch } from 'react-redux'
import { setUserData } from './redux/userSlice'
import Login from './pages/Login'
import Home from './pages/Home'
import { BrowserRouter } from 'react-router-dom'
import AppRoutes from './routes/AppRoutes'


const App = () => {
  const dispatch = useDispatch()
  useEffect(() => {
    const getUser = async () => {
      const data = await getCurrentUser()
      dispatch(setUserData(data))
    }
    getUser()
  }, [])
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  )
}

export default App