import { createClient } from '@supabase/supabase-js'

// کلیدهای شما (از .env باید استفاده کنید)
const supabaseUrl = 'https://qqoqfqquxgglaoduughr.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFxb3FmcXF1eGdnbGFvZHV1Z2hyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc1MTM4NDAsImV4cCI6MjA4MzA4OTg0MH0.Kr7WeQu-NJ60G0s4mod1Z5JnEferX8EbPAOy9OHYbHM'

// ایجاد کلاینت Supabase
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  },
  db: {
    schema: 'public'
  },
  global: {
    headers: {
      'x-application-name': 'sodmax-cityverse',
      'x-app-version': '2.0.0'
    }
  }
})

// ============================================
// 🔐 توابع احراز هویت
// ============================================

export const authAPI = {
  // ثبت‌نام با شماره موبایل
  async register(userData) {
    try {
      const { phone, full_name, password, referral_code } = userData
      
      // بررسی وجود کاربر
      const { data: existingUser, error: checkError } = await supabase
        .from('users')
        .select('id')
        .eq('phone', phone)
        .single()
      
      if (existingUser) {
        return {
          success: false,
          error: 'این شماره موبایل قبلاً ثبت‌نام کرده است'
        }
      }
      
      // هش کردن رمز عبور
      const passwordHash = await this.hashPassword(password)
      
      // تولید کد دعوت
      const referralCode = this.generateReferralCode(full_name)
      
      // ایجاد کاربر جدید
      const { data: user, error: createError } = await supabase
        .from('users')
        .insert({
          phone,
          full_name,
          password_hash: passwordHash,
          avatar_text: full_name.substring(0, 2).toUpperCase(),
          referral_code: referralCode,
          referral_link: `https://sodmax.city/invite/${referralCode}`,
          user_level: 1,
          sod_balance: 1000,
          mining_power: 5,
          is_active: true,
          notification_enabled: true,
          sound_enabled: true,
          vibration_enabled: true
        })
        .select()
        .single()
      
      if (createError) throw createError
      
      // پردازش کد دعوت
      if (referral_code) {
        await this.processReferral(referral_code, user.id, full_name)
      }
      
      // نوتیفیکیشن خوش‌آمدگویی
      await supabase
        .from('notifications')
        .insert({
          user_id: user.id,
          notification_type: 'system',
          title: '👋 به SODmAX خوش آمدید',
          message: 'حساب کاربری شما با موفقیت ایجاد شد! ۱۰۰۰ SOD هدیه دریافت کردید.',
          icon: 'party',
          color: 'primary',
          is_read: false
        })
      
      // ذخیره در localStorage
      localStorage.setItem('sodmax_user', JSON.stringify(user))
      localStorage.setItem('sodmax_token', 'user-' + Date.now())
      
      return {
        success: true,
        user,
        message: 'حساب کاربری با موفقیت ایجاد شد!'
      }
      
    } catch (error) {
      console.error('ثبت‌نام خطا:', error)
      return {
        success: false,
        error: error.message || 'خطا در ثبت‌نام'
      }
    }
  },
  
  // ورود کاربر
  async login(phone, password) {
    try {
      // در حالت واقعی باید رمز عبور هش شده بررسی شود
      // فعلاً با کاربر تست کار می‌کنیم
      
      const { data: user, error } = await supabase
        .from('users')
        .select('*')
        .eq('phone', phone)
        .single()
      
      if (error || !user) {
        return {
          success: false,
          error: 'شماره موبایل یا رمز عبور اشتباه است'
        }
      }
      
      // بررسی رمز عبور (در حالت واقعی با hash مقایسه شود)
      // فعلاً برای کاربر تست، هر رمزی قبول می‌شود
      if (phone === '09123456789') {
        // کاربر تست - هر رمزی قبول است
      } else {
        // در حالت واقعی:
        // const isValid = await this.verifyPassword(password, user.password_hash)
        // if (!isValid) throw new Error('رمز عبور اشتباه است')
      }
      
      // به‌روزرسانی وضعیت ورود
      await supabase
        .from('users')
        .update({
          last_login_date: new Date().toISOString().split('T')[0],
          last_seen: new Date().toISOString(),
          is_online: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id)
      
      // ذخیره در localStorage
      localStorage.setItem('sodmax_user', JSON.stringify(user))
      localStorage.setItem('sodmax_token', 'user-' + Date.now())
      
      // ایجاد آمار روزانه اگر وجود ندارد
      await this.createDailyStats(user.id)
      
      return {
        success: true,
        user,
        message: 'ورود موفقیت‌آمیز بود!'
      }
      
    } catch (error) {
      console.error('ورود خطا:', error)
      return {
        success: false,
        error: error.message || 'خطا در ورود'
      }
    }
  },
  
  // دریافت کاربر جاری
  async getCurrentUser() {
    try {
      const userJson = localStorage.getItem('sodmax_user')
      if (!userJson) return null
      
      const user = JSON.parse(userJson)
      
      // به‌روزرسانی از دیتابیس
      const { data: freshUser, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single()
      
      if (error) {
        console.error('خطا در دریافت کاربر:', error)
        return null
      }
      
      // ذخیره مجدد
      localStorage.setItem('sodmax_user', JSON.stringify(freshUser))
      
      return freshUser
      
    } catch (error) {
      console.error('خطا در دریافت کاربر جاری:', error)
      return null
    }
  },
  
  // خروج از حساب
  async logout() {
    try {
      const userJson = localStorage.getItem('sodmax_user')
      if (userJson) {
        const user = JSON.parse(userJson)
        
        // به‌روزرسانی وضعیت آفلاین
        await supabase
          .from('users')
          .update({
            is_online: false,
            last_seen: new Date().toISOString()
          })
          .eq('id', user.id)
      }
      
      // پاک کردن localStorage
      localStorage.removeItem('sodmax_user')
      localStorage.removeItem('sodmax_token')
      
      return { success: true, message: 'با موفقیت خارج شدید' }
      
    } catch (error) {
      console.error('خطا در خروج:', error)
      return { success: false, error: error.message }
    }
  },
  
  // پردازش کد دعوت
  async processReferral(referralCode, newUserId, newUserName) {
    try {
      // پیدا کردن معرف
      const { data: referrer, error } = await supabase
        .from('users')
        .select('id, full_name')
        .eq('referral_code', referralCode)
        .single()
      
      if (error || !referrer) return
      
      // ثبت دعوت
      await supabase
        .from('referrals')
        .insert({
          referrer_id: referrer.id,
          referred_id: newUserId,
          referral_code_used: referralCode,
          status: 'registered',
          registered_at: new Date().toISOString()
        })
      
      // اضافه کردن پاداش به کاربر جدید
      await supabase
        .from('users')
        .update({
          sod_balance: 1500, // 1000 + 500 پاداش دعوت
          referred_by: referrer.id
        })
        .eq('id', newUserId)
      
      // نوتیفیکیشن به معرف
      await supabase
        .from('notifications')
        .insert({
          user_id: referrer.id,
          notification_type: 'referral',
          title: '🤝 دعوت موفق',
          message: `${newUserName} با کد دعوت شما ثبت‌نام کرد! ۵۰۰ SOD پاداش دریافت کردید.`,
          icon: 'user-plus',
          color: 'secondary',
          is_read: false
        })
      
      // افزایش تعداد دعوت‌های معرف
      await supabase.rpc('increment_referral_count', { user_id: referrer.id })
      
    } catch (error) {
      console.error('خطا در پردازش دعوت:', error)
    }
  },
  
  // ایجاد آمار روزانه
  async createDailyStats(userId) {
    try {
      const today = new Date().toISOString().split('T')[0]
      
      const { data: existingStats } = await supabase
        .from('user_stats')
        .select('id')
        .eq('user_id', userId)
        .eq('date', today)
        .single()
      
      if (!existingStats) {
        await supabase
          .from('user_stats')
          .insert({
            user_id: userId,
            date: today,
            total_logins: 1
          })
      } else {
        await supabase
          .from('user_stats')
          .update({
            total_logins: supabase.rpc('increment', { x: 1 }),
            updated_at: new Date().toISOString()
          })
          .eq('id', existingStats.id)
      }
      
    } catch (error) {
      console.error('خطا در ایجاد آمار:', error)
    }
  },
  
  // هش کردن رمز عبور (ساده)
  async hashPassword(password) {
    // در حالت واقعی از bcrypt یا Web Crypto API استفاده کنید
    return 'hashed_' + btoa(password + 'sodmax_salt')
  },
  
  // تولید کد دعوت
  generateReferralCode(name) {
    const namePart = name.replace(/\s/g, '').substring(0, 3).toUpperCase()
    const randomPart = Math.floor(10000 + Math.random() * 90000)
    return `${namePart}${randomPart}`
  }
}

// ============================================
// ⛏️ توابع استخراج
// ============================================

export const miningAPI = {
  // استخراج دستی
  async manualMine(userId) {
    try {
      // دریافت اطلاعات کاربر
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('mining_power, mining_multiplier, streak_days, user_level, mining_level')
        .eq('id', userId)
        .single()
      
      if (userError) throw userError
      
      // محاسبه مقدار استخراج
      const basePower = user.mining_power || 5
      const multiplier = user.mining_multiplier || 1
      const streakBonus = Math.min(user.streak_days || 1, 7) * 2 // 2% برای هر روز streak
      
      let amount = Math.floor(basePower * multiplier)
      
      // اعمال bonus streak
      if (streakBonus > 0) {
        amount += Math.floor(amount * streakBonus / 100)
      }
      
      // حداقل 1 SOD
      amount = Math.max(amount, 1)
      
      // ثبت در لاگ استخراج
      const { data: log, error: logError } = await supabase
        .from('mining_logs')
        .insert({
          user_id: userId,
          amount_mined: amount,
          mining_type: 'manual',
          power_multiplier: multiplier,
          base_power: basePower,
          mining_level: user.mining_level,
          streak_bonus: streakBonus,
          device_type: 'web',
          mining_hour: new Date().getHours()
        })
        .select()
        .single()
      
      if (logError) throw logError
      
      // به‌روزرسانی موجودی کاربر
      const { error: updateError } = await supabase
        .from('users')
        .update({
          sod_balance: supabase.rpc('increment', { x: amount }),
          total_mined_sod: supabase.rpc('increment', { x: amount }),
          today_mined_sod: supabase.rpc('increment', { x: amount }),
          total_clicks: supabase.rpc('increment', { x: 1 }),
          updated_at: new Date().toISOString()
        })
        .eq('id', userId)
      
      if (updateError) throw updateError
      
      // ثبت تراکنش
      await supabase
        .from('transactions')
        .insert({
          user_id: userId,
          transaction_type: 'mining',
          amount: amount,
          currency: 'SOD',
          description: 'استخراج دستی',
          status: 'completed',
          confirmed_by_user: true
        })
      
      // به‌روزرسانی آمار
      await this.updateMiningStats(userId, amount)
      
      return {
        success: true,
        amount,
        logId: log.id,
        message: `استخراج موفق! +${amount} SOD`
      }
      
    } catch (error) {
      console.error('خطا در استخراج:', error)
      return {
        success: false,
        error: error.message || 'خطا در استخراج'
      }
    }
  },
  
  // دریافت آمار استخراج
  async getMiningStats(userId) {
    try {
      // آمار امروز
      const today = new Date().toISOString().split('T')[0]
      const { data: todayStats, error: todayError } = await supabase
        .from('mining_logs')
        .select('amount_mined')
        .eq('user_id', userId)
        .gte('created_at', today)
      
      if (todayError) throw todayError
      
      // آمار کلی کاربر
      const { data: userStats, error: userError } = await supabase
        .from('users')
        .select('total_mined_sod, today_mined_sod, mining_power, mining_multiplier, mining_level')
        .eq('id', userId)
        .single()
      
      if (userError) throw userError
      
      // محاسبه کل امروز
      const todayTotal = todayStats?.reduce((sum, log) => sum + (log.amount_mined || 0), 0) || 0
      
      return {
        today: todayTotal,
        total: userStats.total_mined_sod || 0,
        power: userStats.mining_power || 5,
        multiplier: userStats.mining_multiplier || 1,
        level: userStats.mining_level || 1
      }
      
    } catch (error) {
      console.error('خطا در دریافت آمار استخراج:', error)
      return {
        today: 0,
        total: 0,
        power: 5,
        multiplier: 1,
        level: 1
      }
    }
  },
  
  // به‌روزرسانی آمار استخراج
  async updateMiningStats(userId, amount) {
    try {
      const today = new Date().toISOString().split('T')[0]
      
      // بررسی وجود آمار امروز
      const { data: existingStats } = await supabase
        .from('user_stats')
        .select('id, mined_today')
        .eq('user_id', userId)
        .eq('date', today)
        .single()
      
      if (existingStats) {
        // به‌روزرسانی آمار موجود
        await supabase
          .from('user_stats')
          .update({
            mined_today: (existingStats.mined_today || 0) + amount,
            total_mining_sessions: supabase.rpc('increment', { x: 1 }),
            updated_at: new Date().toISOString()
          })
          .eq('id', existingStats.id)
      } else {
        // ایجاد آمار جدید
        await supabase
          .from('user_stats')
          .insert({
            user_id: userId,
            date: today,
            mined_today: amount,
            total_mining_sessions: 1
          })
      }
      
    } catch (error) {
      console.error('خطا در به‌روزرسانی آمار:', error)
    }
  },
  
  // دریافت لاگ استخراج
  async getMiningLogs(userId, limit = 10) {
    try {
      const { data, error } = await supabase
        .from('mining_logs')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit)
      
      if (error) throw error
      return data || []
      
    } catch (error) {
      console.error('خطا در دریافت لاگ استخراج:', error)
      return []
    }
  }
}

// ============================================
// 🎯 توابع مأموریت‌ها
// ============================================

export const missionsAPI = {
  // دریافت مأموریت‌های قابل انجام
  async getAvailableMissions(userId) {
    try {
      const { data: missions, error } = await supabase
        .from('missions')
        .select('*')
        .eq('is_active', true)
        .order('priority', { ascending: false })
      
      if (error) throw error
      
      // دریافت مأموریت‌های کاربر
      const { data: userMissions } = await supabase
        .from('user_missions')
        .select('mission_id, status')
        .eq('user_id', userId)
      
      const userMissionMap = new Map()
      userMissions?.forEach(um => {
        userMissionMap.set(um.mission_id, um.status)
      })
      
      // اضافه کردن وضعیت
      const missionsWithStatus = missions.map(mission => ({
        ...mission,
        userStatus: userMissionMap.get(mission.id) || 'available',
        isCompleted: userMissionMap.get(mission.id) === 'completed',
        isInProgress: userMissionMap.get(mission.id) === 'in_progress'
      }))
      
      return missionsWithStatus
      
    } catch (error) {
      console.error('خطا در دریافت مأموریت‌ها:', error)
      return []
    }
  },
  
  // شروع مأموریت
  async startMission(userId, missionId) {
    try {
      // بررسی اینکه قبلاً شروع نشده باشد
      const { data: existing } = await supabase
        .from('user_missions')
        .select('id')
        .eq('user_id', userId)
        .eq('mission_id', missionId)
        .in('status', ['in_progress', 'pending_review'])
        .single()
      
      if (existing) {
        return {
          success: false,
          error: 'شما قبلاً این مأموریت را شروع کرده‌اید'
        }
      }
      
      // شروع مأموریت
      const { data, error } = await supabase
        .from('user_missions')
        .insert({
          user_id: userId,
          mission_id: missionId,
          status: 'in_progress',
          started_at: new Date().toISOString(),
          progress_percentage: 0,
          current_step: 1
        })
        .select()
        .single()
      
      if (error) throw error
      
      // به‌روزرسانی آمار
      await this.updateMissionStats(userId, 'started')
      
      return {
        success: true,
        userMission: data,
        message: 'مأموریت شروع شد!'
      }
      
    } catch (error) {
      console.error('خطا در شروع مأموریت:', error)
      return {
        success: false,
        error: error.message || 'خطا در شروع مأموریت'
      }
    }
  },
  
  // تکمیل مأموریت
  async completeMission(userMissionId) {
    try {
      // دریافت اطلاعات مأموریت کاربر
      const { data: userMission, error: umError } = await supabase
        .from('user_missions')
        .select(`
          *,
          missions (*)
        `)
        .eq('id', userMissionId)
        .single()
      
      if (umError) throw umError
      
      // بررسی اینکه مأموریت در حال پیشرفت باشد
      if (userMission.status !== 'in_progress') {
        return {
          success: false,
          error: 'مأموریت در وضعیت قابل تکمیل نیست'
        }
      }
      
      // دریافت اطلاعات پاداش
      const mission = userMission.missions
      const rewardAmount = mission.base_reward || 0
      const rewardCurrency = mission.reward_currency || 'SOD'
      const xpReward = mission.xp_reward || 10
      
      // به‌روزرسانی وضعیت مأموریت
      const { error: updateError } = await supabase
        .from('user_missions')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          progress_percentage: 100,
          base_reward_given: rewardAmount,
          xp_earned: xpReward,
          total_reward: rewardAmount,
          reward_granted: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', userMissionId)
      
      if (updateError) throw updateError
      
      // اعطای پاداش به کاربر
      if (rewardCurrency === 'SOD') {
        await supabase
          .from('users')
          .update({
            sod_balance: supabase.rpc('increment', { x: rewardAmount }),
            current_xp: supabase.rpc('increment', { x: xpReward }),
            total_missions_completed: supabase.rpc('increment', { x: 1 }),
            updated_at: new Date().toISOString()
          })
          .eq('id', userMission.user_id)
      } else if (rewardCurrency === 'TOMAN') {
        await supabase
          .from('users')
          .update({
            toman_balance: supabase.rpc('increment', { x: rewardAmount }),
            current_xp: supabase.rpc('increment', { x: xpReward }),
            total_earned_toman: supabase.rpc('increment', { x: rewardAmount }),
            total_missions_completed: supabase.rpc('increment', { x: 1 }),
            updated_at: new Date().toISOString()
          })
          .eq('id', userMission.user_id)
      }
      
      // ثبت تراکنش
      await supabase
        .from('transactions')
        .insert({
          user_id: userMission.user_id,
          transaction_type: 'mission_reward',
          amount: rewardAmount,
          currency: rewardCurrency,
          description: `پاداش مأموریت: ${mission.mission_title}`,
          status: 'completed',
          confirmed_by_user: true
        })
      
      // نوتیفیکیشن
      await supabase
        .from('notifications')
        .insert({
          user_id: userMission.user_id,
          notification_type: 'mission',
          title: '✅ مأموریت تکمیل شد',
          message: `مأموریت "${mission.mission_title}" تکمیل شد! ${rewardAmount} ${rewardCurrency} دریافت کردید.`,
          icon: 'trophy',
          color: 'success',
          is_read: false
        })
      
      // به‌روزرسانی آمار
      await this.updateMissionStats(userMission.user_id, 'completed')
      
      return {
        success: true,
        reward: rewardAmount,
        currency: rewardCurrency,
        xp: xpReward,
        message: `مأموریت با موفقیت تکمیل شد! ${rewardAmount} ${rewardCurrency} دریافت کردید.`
      }
      
    } catch (error) {
      console.error('خطا در تکمیل مأموریت:', error)
      return {
        success: false,
        error: error.message || 'خطا در تکمیل مأموریت'
      }
    }
  },
  
  // دریافت مأموریت‌های کاربر
  async getUserMissions(userId) {
    try {
      const { data, error } = await supabase
        .from('user_missions')
        .select(`
          *,
          missions (*)
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
      
      if (error) throw error
      return data || []
      
    } catch (error) {
      console.error('خطا در دریافت مأموریت‌های کاربر:', error)
      return []
    }
  },
  
  // به‌روزرسانی آمار مأموریت‌ها
  async updateMissionStats(userId, action) {
    try {
      const today = new Date().toISOString().split('T')[0]
      
      // بررسی وجود آمار امروز
      const { data: existingStats } = await supabase
        .from('user_stats')
        .select('id, total_missions_started, total_missions_completed')
        .eq('user_id', userId)
        .eq('date', today)
        .single()
      
      if (existingStats) {
        const updates = { updated_at: new Date().toISOString() }
        
        if (action === 'started') {
          updates.total_missions_started = (existingStats.total_missions_started || 0) + 1
        } else if (action === 'completed') {
          updates.total_missions_completed = (existingStats.total_missions_completed || 0) + 1
        }
        
        await supabase
          .from('user_stats')
          .update(updates)
          .eq('id', existingStats.id)
          
      } else {
        const newStats = {
          user_id: userId,
          date: today
        }
        
        if (action === 'started') {
          newStats.total_missions_started = 1
        } else if (action === 'completed') {
          newStats.total_missions_completed = 1
        }
        
        await supabase
          .from('user_stats')
          .insert(newStats)
      }
      
    } catch (error) {
      console.error('خطا در به‌روزرسانی آمار مأموریت:', error)
    }
  }
}

// ============================================
// 💰 توابع کیف پول
// ============================================

export const walletAPI = {
  // دریافت موجودی کاربر
  async getBalance(userId) {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('sod_balance, toman_balance, usdt_balance')
        .eq('id', userId)
        .single()
      
      if (error) throw error
      
      return {
        sod: data.sod_balance || 0,
        toman: data.toman_balance || 0,
        usdt: data.usdt_balance || 0
      }
      
    } catch (error) {
      console.error('خطا در دریافت موجودی:', error)
      return { sod: 0, toman: 0, usdt: 0 }
    }
  },
  
  // دریافت تراکنش‌ها
  async getTransactions(userId, limit = 20) {
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit)
      
      if (error) throw error
      return data || []
      
    } catch (error) {
      console.error('خطا در دریافت تراکنش‌ها:', error)
      return []
    }
  },
  
  // درخواست برداشت
  async requestWithdrawal(userId, amount, method, accountDetails) {
    try {
      // بررسی موجودی
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('toman_balance, full_name')
        .eq('id', userId)
        .single()
      
      if (userError) throw userError
      
      if (user.toman_balance < amount) {
        return {
          success: false,
          error: 'موجودی کافی نیست'
        }
      }
      
      // محاسبه کارمزد (2%)
      const feeAmount = Math.floor(amount * 2 / 100)
      const netAmount = amount - feeAmount
      
      // ایجاد کد رهگیری
      const trackingCode = 'WD' + Date.now() + Math.floor(Math.random() * 1000)
      
      // ثبت درخواست برداشت
      const { data: withdrawal, error: withdrawalError } = await supabase
        .from('withdrawals')
        .insert({
          user_id: userId,
          amount: amount,
          fee_amount: feeAmount,
          net_amount: netAmount,
          withdrawal_method: method,
          account_details: accountDetails,
          account_holder_name: user.full_name,
          tracking_code: trackingCode,
          status: 'pending',
          estimated_completion: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        })
        .select()
        .single()
      
      if (withdrawalError) throw withdrawalError
      
      // کسر از موجودی
      await supabase
        .from('users')
        .update({
          toman_balance: user.toman_balance - amount,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId)
      
      // ثبت تراکنش
      await supabase
        .from('transactions')
        .insert({
          user_id: userId,
          transaction_type: 'withdrawal',
          amount: -amount,
          currency: 'TOMAN',
          fee_amount: feeAmount,
          description: `برداشت از طریق ${method}`,
          status: 'pending',
          reference_id: trackingCode
        })
      
      // نوتیفیکیشن
      await supabase
        .from('notifications')
        .insert({
          user_id: userId,
          notification_type: 'withdrawal',
          title: '💳 درخواست برداشت ثبت شد',
          message: `درخواست برداشت ${amount.toLocaleString('fa-IR')} تومان ثبت شد. کد رهگیری: ${trackingCode}`,
          icon: 'download',
          color: 'info',
          is_read: false
        })
      
      return {
        success: true,
        withdrawal,
        trackingCode,
        message: 'درخواست برداشت با موفقیت ثبت شد'
      }
      
    } catch (error) {
      console.error('خطا در درخواست برداشت:', error)
      return {
        success: false,
        error: error.message || 'خطا در ثبت درخواست برداشت'
      }
    }
  },
  
  // دریافت تاریخچه برداشت‌ها
  async getWithdrawals(userId) {
    try {
      const { data, error } = await supabase
        .from('withdrawals')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
      
      if (error) throw error
      return data || []
      
    } catch (error) {
      console.error('خطا در دریافت برداشت‌ها:', error)
      return []
    }
  }
}

// ============================================
// 🤝 توابع دعوت
// ============================================

export const referralAPI = {
  // دریافت اطلاعات دعوت
  async getReferralInfo(userId) {
    try {
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('referral_code, referral_link, referral_count, referral_earnings, full_name')
        .eq('id', userId)
        .single()
      
      if (userError) throw userError
      
      // دریافت لیست دعوت‌ها
      const { data: referrals, error: refError } = await supabase
        .from('referrals')
        .select(`
          *,
          referred_user:users!referrals_referred_id_fkey(full_name, phone, created_at)
        `)
        .eq('referrer_id', userId)
        .order('created_at', { ascending: false })
      
      if (refError) throw refError
      
      return {
        code: user.referral_code,
        link: user.referral_link,
        totalReferrals: user.referral_count || 0,
        totalEarnings: user.referral_earnings || 0,
        referrals: referrals || []
      }
      
    } catch (error) {
      console.error('خطا در دریافت اطلاعات دعوت:', error)
      return {
        code: '',
        link: '',
        totalReferrals: 0,
        totalEarnings: 0,
        referrals: []
      }
    }
  },
  
  // بررسی کد دعوت
  async validateReferralCode(code) {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, full_name')
        .eq('referral_code', code)
        .single()
      
      if (error) return null
      return data
      
    } catch (error) {
      console.error('خطا در بررسی کد دعوت:', error)
      return null
    }
  },
  
  // کپی کردن لینک دعوت
  copyReferralLink(link) {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(link)
      return true
    } else {
      // Fallback برای مرورگرهای قدیمی
      const textArea = document.createElement('textarea')
      textArea.value = link
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand('copy')
      document.body.removeChild(textArea)
      return true
    }
  }
}

// ============================================
// 🔔 توابع نوتیفیکیشن
// ============================================

export const notificationsAPI = {
  // دریافت نوتیفیکیشن‌ها
  async getNotifications(userId, unreadOnly = false) {
    try {
      let query = supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50)
      
      if (unreadOnly) {
        query = query.eq('is_read', false)
      }
      
      const { data, error } = await query
      
      if (error) throw error
      return data || []
      
    } catch (error) {
      console.error('خطا در دریافت نوتیفیکیشن‌ها:', error)
      return []
    }
  },
  
  // تعداد نوتیفیکیشن‌های خوانده نشده
  async getUnreadCount(userId) {
    try {
      const { count, error } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('is_read', false)
      
      if (error) throw error
      return count || 0
      
    } catch (error) {
      console.error('خطا در دریافت تعداد نوتیفیکیشن‌ها:', error)
      return 0
    }
  },
  
  // علامت‌گذاری به عنوان خوانده شده
  async markAsRead(notificationId) {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({
          is_read: true,
          read_at: new Date().toISOString()
        })
        .eq('id', notificationId)
      
      if (error) throw error
      return { success: true }
      
    } catch (error) {
      console.error('خطا در علامت‌گذاری نوتیفیکیشن:', error)
      return { success: false, error: error.message }
    }
  },
  
  // علامت‌گذاری همه به عنوان خوانده شده
  async markAllAsRead(userId) {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({
          is_read: true,
          read_at: new Date().toISOString()
        })
        .eq('user_id', userId)
        .eq('is_read', false)
      
      if (error) throw error
      return { success: true }
      
    } catch (error) {
      console.error('خطا در علامت‌گذاری همه نوتیفیکیشن‌ها:', error)
      return { success: false, error: error.message }
    }
  }
}

// ============================================
// 📊 توابع آمار و گزارش
// ============================================

export const statsAPI = {
  // دریافت آمار کاربر
  async getUserStats(userId) {
    try {
      // اطلاعات اصلی کاربر
      const { data: user, error: userError } = await supabase
        .from('users')
        .select(`
          user_level,
          current_xp,
          required_xp,
          total_mined_sod,
          total_earned_toman,
          total_missions_completed,
          streak_days,
          total_login_days,
          referral_count
        `)
        .eq('id', userId)
        .single()
      
      if (userError) throw userError
      
      // آمار امروز
      const today = new Date().toISOString().split('T')[0]
      const { data: todayStats } = await supabase
        .from('user_stats')
        .select('*')
        .eq('user_id', userId)
        .eq('date', today)
        .single()
      
      // محاسبه درصد XP
      const xpPercentage = user.required_xp > 0 
        ? (user.current_xp / user.required_xp) * 100 
        : 0
      
      return {
        ...user,
        todayStats: todayStats || {},
        xpPercentage: Math.min(xpPercentage, 100)
      }
      
    } catch (error) {
      console.error('خطا در دریافت آمار کاربر:', error)
      return null
    }
  },
  
  // دریافت نمودار فعالیت
  async getActivityChart(userId, days = 7) {
    try {
      const startDate = new Date()
      startDate.setDate(startDate.getDate() - days)
      
      const { data, error } = await supabase
        .from('user_stats')
        .select('date, mined_today, earned_today_toman')
        .eq('user_id', userId)
        .gte('date', startDate.toISOString().split('T')[0])
        .order('date', { ascending: true })
      
      if (error) throw error
      
      // پر کردن تاریخ‌های خالی
      const chartData = []
      for (let i = 0; i < days; i++) {
        const date = new Date()
        date.setDate(date.getDate() - (days - i - 1))
        const dateStr = date.toISOString().split('T')[0]
        
        const dayData = data?.find(d => d.date === dateStr) || {
          date: dateStr,
          mined_today: 0,
          earned_today_toman: 0
        }
        
        chartData.push(dayData)
      }
      
      return chartData
      
    } catch (error) {
      console.error('خطا در دریافت نمودار فعالیت:', error)
      return []
    }
  }
}

// ============================================
// 🏢 توابع کسب‌وکار (پایه)
// ============================================

export const businessAPI = {
  // بررسی اینکه کاربر کسب‌وکار دارد
  async hasBusiness(userId) {
    try {
      const { data, error } = await supabase
        .from('businesses')
        .select('id')
        .eq('user_id', userId)
        .single()
      
      return { hasBusiness: !!data, business: data }
      
    } catch (error) {
      return { hasBusiness: false, business: null }
    }
  },
  
  // ایجاد کسب‌وکار
  async createBusiness(userId, businessData) {
    try {
      const { data, error } = await supabase
        .from('businesses')
        .insert({
          user_id: userId,
          ...businessData,
          verification_status: 'pending',
          is_active: true
        })
        .select()
        .single()
      
      if (error) throw error
      
      // به‌روزرسانی کاربر
      await supabase
        .from('users')
        .update({
          is_business_account: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId)
      
      return {
        success: true,
        business: data,
        message: 'کسب‌وکار با موفقیت ثبت شد'
      }
      
    } catch (error) {
      console.error('خطا در ایجاد کسب‌وکار:', error)
      return {
        success: false,
        error: error.message || 'خطا در ثبت کسب‌وکار'
      }
    }
  }
}

// ============================================
// 🔄 Real-time Subscriptions
// ============================================

export const realtimeAPI = {
  // گوش دادن به تغییرات کاربر
  subscribeToUser(userId, callback) {
    const subscription = supabase
      .channel(`user-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'users',
          filter: `id=eq.${userId}`
        },
        (payload) => {
          callback(payload.new)
        }
      )
      .subscribe()
    
    return subscription
  },
  
  // گوش دادن به نوتیفیکیشن‌های جدید
  subscribeToNotifications(userId, callback) {
    const subscription = supabase
      .channel(`notifications-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`
        },
        (payload) => {
          callback(payload.new)
        }
      )
      .subscribe()
    
    return subscription
  },
  
  // گوش دادن به تراکنش‌های جدید
  subscribeToTransactions(userId, callback) {
    const subscription = supabase
      .channel(`transactions-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'transactions',
          filter: `user_id=eq.${userId}`
        },
        (payload) => {
          callback(payload.new)
        }
      )
      .subscribe()
    
    return subscription
  }
}

// ============================================
// 🎯 توابع کمکی
// ============================================

export const utils = {
  // فرمت کردن اعداد
  formatNumber(num) {
    if (!num && num !== 0) return '0'
    
    if (num >= 1000000) {
      return (num / 1000000).toFixed(2).replace(/\.00$/, '') + 'M'
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K'
    }
    return num.toString()
  },
  
  // فرمت کردن تاریخ
  formatDate(dateString) {
    const date = new Date(dateString)
    const now = new Date()
    const diff = now - date
    
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(minutes / 60)
    const days = Math.floor(hours / 24)
    
    if (minutes < 1) return 'همین الان'
    if (minutes < 60) return `${minutes} دقیقه پیش`
    if (hours < 24) return `${hours} ساعت پیش`
    if (days < 7) return `${days} روز پیش`
    
    return date.toLocaleDateString('fa-IR')
  },
  
  // ایجاد تاخیر
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

// ============================================
// 📦 اکسپورت اصلی
// ============================================

export default {
  supabase,
  authAPI,
  miningAPI,
  missionsAPI,
  walletAPI,
  referralAPI,
  notificationsAPI,
  statsAPI,
  businessAPI,
  realtimeAPI,
  utils
}
