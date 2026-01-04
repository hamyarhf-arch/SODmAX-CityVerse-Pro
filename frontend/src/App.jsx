import React, { useState, useEffect } from 'react'
import { authAPI, miningAPI, walletAPI, utils } from './lib/supabase'

function App() {
  const [user, setUser] = useState(null)
  const [balance, setBalance] = useState({ sod: 0, toman: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    checkUser()
  }, [])

  const checkUser = async () => {
    const currentUser = await authAPI.getCurrentUser()
    if (currentUser) {
      setUser(currentUser)
      const userBalance = await walletAPI.getBalance(currentUser.id)
      setBalance(userBalance)
    }
    setLoading(false)
  }

  const handleLogin = async () => {
    const result = await authAPI.login('09123456789', '123456')
    if (result.success) {
      setUser(result.user)
      const userBalance = await walletAPI.getBalance(result.user.id)
      setBalance(userBalance)
    } else {
      alert(result.error)
    }
  }

  const handleMine = async () => {
    if (!user) return
    
    const result = await miningAPI.manualMine(user.id)
    if (result.success) {
      alert(result.message)
      // به‌روزرسانی موجودی
      const newBalance = await walletAPI.getBalance(user.id)
      setBalance(newBalance)
    } else {
      alert(result.error)
    }
  }

  if (loading) return <div>در حال بارگذاری...</div>

  return (
    <div style={{ padding: '20px', fontFamily: 'Vazirmatn, sans-serif' }}>
      {user ? (
        <div>
          <h1>👋 خوش آمدید {user.full_name}!</h1>
          <div style={{ background: '#1e293b', padding: '20px', borderRadius: '10px', margin: '20px 0' }}>
            <h3>💰 موجودی شما</h3>
            <p>SOD: {utils.formatNumber(balance.sod)}</p>
            <p>تومان: {utils.formatNumber(balance.toman)}</p>
          </div>
          
          <button 
            onClick={handleMine}
            style={{
              background: 'linear-gradient(135deg, #0066FF, #3395FF)',
              color: 'white',
              border: 'none',
              padding: '15px 30px',
              borderRadius: '10px',
              fontSize: '18px',
              cursor: 'pointer',
              margin: '10px'
            }}
          >
            ⛏️ استخراج کن
          </button>

          <button 
            onClick={() => authAPI.logout()}
            style={{
              background: '#ef4444',
              color: 'white',
              border: 'none',
              padding: '10px 20px',
              borderRadius: '8px',
              cursor: 'pointer'
            }}
          >
            خروج
          </button>
        </div>
      ) : (
        <div>
          <h1>🔥 SODmAX CityVerse</h1>
          <p>پلتفرم کسب درآمد هوشمند</p>
          
          <button 
            onClick={handleLogin}
            style={{
              background: 'linear-gradient(135deg, #10B981, #34D399)',
              color: 'white',
              border: 'none',
              padding: '15px 30px',
              borderRadius: '10px',
              fontSize: '18px',
              cursor: 'pointer',
              margin: '20px 0'
            }}
          >
            ورود با کاربر تست
          </button>

          <div style={{ marginTop: '30px', color: '#94a3b8' }}>
            <p>📱 شماره تست: 09123456789</p>
            <p>🔐 رمز عبور: 123456</p>
            <p>💰 موجودی اولیه: 1,845,200 SOD</p>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
