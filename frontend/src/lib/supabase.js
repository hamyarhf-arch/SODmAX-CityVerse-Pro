import { createClient } from '@supabase/supabase-js'

// خواندن از متغیرهای محیطی
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://qqoqfqquxgglaoduughr.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFxb3FmcXF1eGdnbGFvZHV1Z2hyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc1MTM4NDAsImV4cCI6MjA4MzA4OTg0MH0.Kr7WeQu-NJ60G0s4mod1Z5JnEferX8EbPAOy9OHYbHM'

// لاگ برای دیباگ
console.log('🔗 اتصال به Supabase:', {
  url: supabaseUrl?.substring(0, 30) + '...',
  hasKey: !!supabaseAnonKey
})

// ایجاد کلاینت Supabase
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false // تغییر به false
  },
  db: {
    schema: 'public'
  }
})

// ============================================
// 🔐 توابع احراز هویت - اصلاح شده
// ============================================

export const authAPI = {
  // ثبت‌نام با شماره موبایل - اصلاح شده
  async register(userData) {
    try {
      console.log('📝 شروع ثبت‌نام:', userData)
      
      const { phone, full_name, password, referral_code } = userData
      
      // بررسی فیلدهای ضروری
      if (!phone || !full_name || !password) {
        return {
          success: false,
          error: 'لطفا تمام فیلدهای ضروری را پر کنید'
        }
      }
      
      // بررسی شماره موبایل
      const phoneRegex = /^09[0-9]{9}$/
      if (!phoneRegex.test(phone)) {
        return {
          success: false,
          error: 'شماره موبایل معتبر وارد کنید (مثال: 09123456789)'
        }
      }
      
      // بررسی وجود کاربر
      const { data: existingUser, error: checkError } = await supabase
        .from('users')
        .select('id')
        .eq('phone', phone)
        .maybeSingle() // استفاده از maybeSingle به جای single
      
      if (checkError && checkError.code !== 'PGRST116') { // PGRST116 یعنی رکورد پیدا نشد
        console.error('خطا در بررسی کاربر:', checkError)
      }
      
      if (existingUser) {
        return {
          success: false,
          error: 'این شماره موبایل قبلاً ثبت‌نام کرده است'
        }
      }
      
      // تولید کد دعوت
      const referralCode = this.generateReferralCode(full_name)
      
      console.log('🆕 ایجاد کاربر جدید...')
      
      // ایجاد کاربر جدید
      const { data: user, error: createError } = await supabase
        .from('users')
        .insert({
          phone,
          full_name,
          password_hash: password, // در حالت واقعی هش شود
          avatar_text: full_name.substring(0, 2).toUpperCase(),
          referral_code: referralCode,
          referral_link: `https://sodmax.city/invite/${referralCode}`,
          user_level: 1,
          sod_balance: 1000,
          mining_power: 5,
          is_active: true,
          notification_enabled: true,
          sound_enabled: true,
          vibration_enabled: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single()
      
      if (createError) {
        console.error('❌ خطا در ایجاد کاربر:', createError)
        throw createError
      }
      
      console.log('✅ کاربر ایجاد شد:', user.id)
      
      // پردازش کد دعوت اگر وجود دارد
      if (referral_code && referral_code.trim() !== '') {
        console.log('🔗 پردازش کد دعوت:', referral_code)
        await this.processReferral(referral_code, user.id, full_name)
      }
      
      // نوتیفیکیشن خوش‌آمدگویی
      try {
        await supabase
          .from('notifications')
          .insert({
            user_id: user.id,
            notification_type: 'system',
            title: '👋 به SODmAX خوش آمدید',
            message: 'حساب کاربری شما با موفقیت ایجاد شد! ۱۰۰۰ SOD هدیه دریافت کردید.',
            icon: 'party',
            color: 'primary',
            is_read: false,
            created_at: new Date().toISOString()
          })
      } catch (notifError) {
        console.warn('⚠️ خطا در ایجاد نوتیفیکیشن:', notifError)
        // ادامه می‌دهیم حتی اگر نوتیفیکیشن ایجاد نشد
      }
      
      // ایجاد آمار اولیه
      try {
        await supabase
          .from('user_stats')
          .insert({
            user_id: user.id,
            date: new Date().toISOString().split('T')[0],
            total_logins: 1,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
      } catch (statsError) {
        console.warn('⚠️ خطا در ایجاد آمار:', statsError)
      }
      
      // ذخیره در localStorage
      localStorage.setItem('sodmax_user', JSON.stringify(user))
      localStorage.setItem('sodmax_token', 'user-' + Date.now())
      
      console.log('🎉 ثبت‌نام موفقیت‌آمیز')
      
      return {
        success: true,
        user,
        message: 'حساب کاربری با موفقیت ایجاد شد! ۱۰۰۰ SOD هدیه دریافت کردید.'
      }
      
    } catch (error) {
      console.error('❌ ثبت‌نام خطا:', error)
      return {
        success: false,
        error: error.message || 'خطا در ثبت‌نام. لطفا دوباره تلاش کنید.'
      }
    }
  },
  
  // ورود کاربر - اصلاح شده
  async login(phone, password) {
    try {
      console.log('🔐 درخواست ورود برای:', phone)
      
      // در حالت واقعی باید رمز عبور هش شده بررسی شود
      // فعلاً با کاربر تست کار می‌کنیم
      
      const { data: user, error } = await supabase
        .from('users')
        .select('*')
        .eq('phone', phone)
        .maybeSingle() // تغییر به maybeSingle
      
      if (error && error.code !== 'PGRST116') {
        console.error('خطا در جستجوی کاربر:', error)
        throw error
      }
      
      if (!user) {
        return {
          success: false,
          error: 'شماره موبایل یا رمز عبور اشتباه است'
        }
      }
      
      console.log('✅ کاربر پیدا شد:', user.full_name)
      
      // بررسی رمز عبور (در حالت واقعی با hash مقایسه شود)
      // فعلاً برای تست، هر رمزی قبول است
      if (phone === '09123456789') {
        // کاربر تست - هر رمزی قبول است
        console.log('👤 کاربر تست - ورود خودکار')
      } else {
        // در حالت واقعی:
        // const isValid = await this.verifyPassword(password, user.password_hash)
        // if (!isValid) {
        //   return { success: false, error: 'رمز عبور اشتباه است' }
        // }
      }
      
      // به‌روزرسانی وضعیت ورود
      const { error: updateError } = await supabase
        .from('users')
        .update({
          last_login_date: new Date().toISOString().split('T')[0],
          last_seen: new Date().toISOString(),
          is_online: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id)
      
      if (updateError) {
        console.warn('⚠️ خطا در به‌روزرسانی وضعیت:', updateError)
      }
      
      // ذخیره در localStorage
      localStorage.setItem('sodmax_user', JSON.stringify(user))
      localStorage.setItem('sodmax_token', 'user-' + Date.now())
      
      // ایجاد یا به‌روزرسانی آمار روزانه
      await this.createDailyStats(user.id)
      
      console.log('✅ ورود موفق:', user.full_name)
      
      return {
        success: true,
        user,
        message: `خوش آمدید ${user.full_name}!`
      }
      
    } catch (error) {
      console.error('❌ خطا در ورود:', error)
      return {
        success: false,
        error: error.message || 'خطا در ورود. لطفا دوباره تلاش کنید.'
      }
    }
  },
  
  // دریافت کاربر جاری - اصلاح شده
  async getCurrentUser() {
    try {
      const userJson = localStorage.getItem('sodmax_user')
      if (!userJson) {
        console.log('⚠️ کاربری در localStorage نیست')
        return null
      }
      
      const user = JSON.parse(userJson)
      
      // به‌روزرسانی از دیتابیس
      const { data: freshUser, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .maybeSingle() // تغییر به maybeSingle
      
      if (error) {
        console.error('❌ خطا در دریافت کاربر:', error)
        // بازگرداندن کاربر از localStorage
        return user
      }
      
      if (!freshUser) {
        console.warn('⚠️ کاربر در دیتابیس پیدا نشد')
        // پاک کردن localStorage
        localStorage.removeItem('sodmax_user')
        localStorage.removeItem('sodmax_token')
        return null
      }
      
      // ذخیره مجدد
      localStorage.setItem('sodmax_user', JSON.stringify(freshUser))
      
      return freshUser
      
    } catch (error) {
      console.error('❌ خطا در دریافت کاربر جاری:', error)
      return null
    }
  },
  
  // خروج از حساب - اصلاح شده
  async logout() {
    try {
      const userJson = localStorage.getItem('sodmax_user')
      if (userJson) {
        const user = JSON.parse(userJson)
        
        // به‌روزرسانی وضعیت آفلاین
        try {
          await supabase
            .from('users')
            .update({
              is_online: false,
              last_seen: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
            .eq('id', user.id)
        } catch (updateError) {
          console.warn('⚠️ خطا در به‌روزرسانی وضعیت خروج:', updateError)
        }
      }
      
      // پاک کردن localStorage
      localStorage.removeItem('sodmax_user')
      localStorage.removeItem('sodmax_token')
      
      console.log('👋 کاربر خارج شد')
      
      return { 
        success: true, 
        message: 'با موفقیت از حساب خارج شدید' 
      }
      
    } catch (error) {
      console.error('❌ خطا در خروج:', error)
      return { 
        success: false, 
        error: error.message 
      }
    }
  },
  
  // پردازش کد دعوت - اصلاح شده
  async processReferral(referralCode, newUserId, newUserName) {
    try {
      console.log('🤝 پردازش کد دعوت:', referralCode)
      
      // پیدا کردن معرف
      const { data: referrer, error } = await supabase
        .from('users')
        .select('id, full_name, sod_balance, referral_count')
        .eq('referral_code', referralCode)
        .maybeSingle()
      
      if (error || !referrer) {
        console.warn('⚠️ کد دعوت نامعتبر است یا کاربر پیدا نشد')
        return
      }
      
      console.log('✅ معرف پیدا شد:', referrer.full_name)
      
      // ثبت دعوت
      try {
        await supabase
          .from('referrals')
          .insert({
            referrer_id: referrer.id,
            referred_id: newUserId,
            referral_code_used: referralCode,
            status: 'registered',
            registered_at: new Date().toISOString(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
      } catch (refError) {
        console.warn('⚠️ خطا در ثبت دعوت:', refError)
      }
      
      // اضافه کردن پاداش به کاربر جدید
      try {
        await supabase
          .from('users')
          .update({
            sod_balance: (await this.getUserBalance(newUserId)).sod + 500,
            referred_by: referrer.id,
            updated_at: new Date().toISOString()
          })
          .eq('id', newUserId)
      } catch (bonusError) {
        console.warn('⚠️ خطا در افزودن پاداش:', bonusError)
      }
      
      // افزودن پاداش به معرف
      try {
        await supabase
          .from('users')
          .update({
            sod_balance: (referrer.sod_balance || 0) + 1000,
            referral_count: (referrer.referral_count || 0) + 1,
            referral_earnings: supabase.rpc('increment', { x: 1000 }),
            updated_at: new Date().toISOString()
          })
          .eq('id', referrer.id)
      } catch (referrerBonusError) {
        console.warn('⚠️ خطا در افزودن پاداش به معرف:', referrerBonusError)
      }
      
      // نوتیفیکیشن به معرف
      try {
        await supabase
          .from('notifications')
          .insert({
            user_id: referrer.id,
            notification_type: 'referral',
            title: '🤝 دعوت موفق',
            message: `${newUserName} با کد دعوت شما ثبت‌نام کرد! ۱,۰۰۰ SOD پاداش دریافت کردید.`,
            icon: 'user-plus',
            color: 'secondary',
            is_read: false,
            created_at: new Date().toISOString()
          })
      } catch (notifError) {
        console.warn('⚠️ خطا در ارسال نوتیفیکیشن:', notifError)
      }
      
      console.log('✅ کد دعوت با موفقیت پردازش شد')
      
    } catch (error) {
      console.error('❌ خطا در پردازش دعوت:', error)
    }
  },
  
  // دریافت موجودی کاربر
  async getUserBalance(userId) {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('sod_balance, toman_balance, usdt_balance')
        .eq('id', userId)
        .maybeSingle()
      
      if (error || !data) {
        return { sod: 0, toman: 0, usdt: 0 }
      }
      
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
  
  // ایجاد آمار روزانه - اصلاح شده
  async createDailyStats(userId) {
    try {
      const today = new Date().toISOString().split('T')[0]
      
      const { data: existingStats, error } = await supabase
        .from('user_stats')
        .select('id, total_logins')
        .eq('user_id', userId)
        .eq('date', today)
        .maybeSingle()
      
      if (error && error.code !== 'PGRST116') {
        console.warn('⚠️ خطا در بررسی آمار:', error)
      }
      
      if (existingStats) {
        // به‌روزرسانی آمار موجود
        await supabase
          .from('user_stats')
          .update({
            total_logins: (existingStats.total_logins || 0) + 1,
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
            total_logins: 1,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
      }
      
    } catch (error) {
      console.error('❌ خطا در ایجاد آمار:', error)
    }
  },
  
  // تولید کد دعوت
  generateReferralCode(name) {
    const namePart = (name || 'USER').replace(/\s/g, '').substring(0, 3).toUpperCase()
    const randomPart = Math.floor(10000 + Math.random() * 90000)
    return `${namePart}${randomPart}`
  }
}

// ============================================
// ⛏️ توابع استخراج - اصلاح شده
// ============================================

export const miningAPI = {
  // استخراج دستی - اصلاح شده
  async manualMine(userId) {
    try {
      console.log('⛏️ درخواست استخراج برای کاربر:', userId)
      
      // دریافت اطلاعات کاربر
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('mining_power, mining_multiplier, streak_days, user_level, mining_level, sod_balance')
        .eq('id', userId)
        .maybeSingle()
      
      if (userError || !user) {
        console.error('❌ خطا در دریافت اطلاعات کاربر:', userError)
        return {
          success: false,
          error: 'خطا در دریافت اطلاعات کاربر'
        }
      }
      
      console.log('👤 اطلاعات کاربر:', user)
      
      // محاسبه مقدار استخراج
      const basePower = user.mining_power || 5
      const multiplier = user.mining_multiplier || 1
      const streakBonus = Math.min(user.streak_days || 1, 7) * 2
      
      let amount = Math.floor(basePower * multiplier)
      
      // اعمال bonus streak
      if (streakBonus > 0) {
        amount += Math.floor(amount * streakBonus / 100)
      }
      
      // حداقل 1 SOD
      amount = Math.max(amount, 1)
      
      console.log('💰 مقدار استخراج:', amount)
      
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
          mining_hour: new Date().getHours(),
          created_at: new Date().toISOString()
        })
        .select()
        .single()
      
      if (logError) {
        console.error('❌ خطا در ثبت لاگ استخراج:', logError)
        throw logError
      }
      
      console.log('📝 لاگ استخراج ثبت شد:', log.id)
      
      // محاسبه موجودی جدید
      const newBalance = (user.sod_balance || 0) + amount
      
      // به‌روزرسانی موجودی کاربر
      const { error: updateError } = await supabase
        .from('users')
        .update({
          sod_balance: newBalance,
          total_mined_sod: supabase.rpc('increment', { x: amount }),
          today_mined_sod: supabase.rpc('increment', { x: amount }),
          total_clicks: supabase.rpc('increment', { x: 1 }),
          updated_at: new Date().toISOString()
        })
        .eq('id', userId)
      
      if (updateError) {
        console.error('❌ خطا در به‌روزرسانی کاربر:', updateError)
        throw updateError
      }
      
      // ثبت تراکنش
      try {
        await supabase
          .from('transactions')
          .insert({
            user_id: userId,
            transaction_type: 'mining',
            amount: amount,
            currency: 'SOD',
            description: 'استخراج دستی',
            status: 'completed',
            confirmed_by_user: true,
            created_at: new Date().toISOString()
          })
      } catch (txError) {
        console.warn('⚠️ خطا در ثبت تراکنش:', txError)
        // ادامه می‌دهیم حتی اگر تراکنش ثبت نشد
      }
      
      // به‌روزرسانی آمار
      await this.updateMiningStats(userId, amount)
      
      console.log('✅ استخراج موفق:', amount, 'SOD')
      
      return {
        success: true,
        amount,
        logId: log.id,
        newBalance,
        message: `استخراج موفق! +${amount} SOD`
      }
      
    } catch (error) {
      console.error('❌ خطا در استخراج:', error)
      return {
        success: false,
        error: error.message || 'خطا در استخراج'
      }
    }
  },
  
  // دریافت آمار استخراج - اصلاح شده
  async getMiningStats(userId) {
    try {
      // آمار امروز
      const today = new Date().toISOString().split('T')[0]
      const { data: todayStats, error: todayError } = await supabase
        .from('mining_logs')
        .select('amount_mined')
        .eq('user_id', userId)
        .gte('created_at', today)
      
      if (todayError) {
        console.warn('⚠️ خطا در دریافت آمار امروز:', todayError)
      }
      
      // آمار کلی کاربر
      const { data: userStats, error: userError } = await supabase
        .from('users')
        .select('total_mined_sod, today_mined_sod, mining_power, mining_multiplier, mining_level')
        .eq('id', userId)
        .maybeSingle()
      
      if (userError) {
        console.warn('⚠️ خطا در دریافت آمار کاربر:', userError)
      }
      
      // محاسبه کل امروز
      const todayTotal = todayStats?.reduce((sum, log) => sum + (log.amount_mined || 0), 0) || 0
      
      return {
        today: todayTotal,
        total: userStats?.total_mined_sod || 0,
        power: userStats?.mining_power || 5,
        multiplier: userStats?.mining_multiplier || 1,
        level: userStats?.mining_level || 1
      }
      
    } catch (error) {
      console.error('❌ خطا در دریافت آمار استخراج:', error)
      return {
        today: 0,
        total: 0,
        power: 5,
        multiplier: 1,
        level: 1
      }
    }
  },
  
  // به‌روزرسانی آمار استخراج - اصلاح شده
  async updateMiningStats(userId, amount) {
    try {
      const today = new Date().toISOString().split('T')[0]
      
      // بررسی وجود آمار امروز
      const { data: existingStats, error } = await supabase
        .from('user_stats')
        .select('id, mined_today, total_mining_sessions')
        .eq('user_id', userId)
        .eq('date', today)
        .maybeSingle()
      
      if (error && error.code !== 'PGRST116') {
        console.warn('⚠️ خطا در بررسی آمار:', error)
      }
      
      if (existingStats) {
        // به‌روزرسانی آمار موجود
        await supabase
          .from('user_stats')
          .update({
            mined_today: (existingStats.mined_today || 0) + amount,
            total_mining_sessions: (existingStats.total_mining_sessions || 0) + 1,
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
            total_mining_sessions: 1,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
      }
      
    } catch (error) {
      console.error('❌ خطا در به‌روزرسانی آمار:', error)
    }
  }
}

// ============================================
// 🎯 توابع مأموریت‌ها - ساده شده
// ============================================

export const missionsAPI = {
  // دریافت مأموریت‌های قابل انجام - ساده شده
  async getAvailableMissions(userId) {
    try {
      // فقط مأموریت‌های فعال سیستم را برگردان
      const { data, error } = await supabase
        .from('missions')
        .select('*')
        .eq('is_active', true)
        .eq('mission_type', 'system')
        .order('priority', { ascending: false })
      
      if (error) {
        console.warn('⚠️ خطا در دریافت مأموریت‌ها:', error)
        return []
      }
      
      return data || []
      
    } catch (error) {
      console.error('❌ خطا در دریافت مأموریت‌ها:', error)
      return []
    }
  }
}

// ============================================
// 💰 توابع کیف پول - ساده شده
// ============================================

export const walletAPI = {
  // دریافت تراکنش‌ها - ساده شده
  async getTransactions(userId, limit = 10) {
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit)
      
      if (error) {
        console.warn('⚠️ خطا در دریافت تراکنش‌ها:', error)
        return []
      }
      
      return data || []
      
    } catch (error) {
      console.error('❌ خطا در دریافت تراکنش‌ها:', error)
      return []
    }
  }
}

// ============================================
// 🤝 توابع دعوت - ساده شده
// ============================================

export const referralAPI = {
  // دریافت اطلاعات دعوت - ساده شده
  async getReferralInfo(userId) {
    try {
      const { data: user, error } = await supabase
        .from('users')
        .select('referral_code, referral_link, referral_count, referral_earnings')
        .eq('id', userId)
        .maybeSingle()
      
      if (error || !user) {
        return {
          code: '',
          link: '',
          totalReferrals: 0,
          totalEarnings: 0
        }
      }
      
      return {
        code: user.referral_code || '',
        link: user.referral_link || '',
        totalReferrals: user.referral_count || 0,
        totalEarnings: user.referral_earnings || 0
      }
      
    } catch (error) {
      console.error('❌ خطا در دریافت اطلاعات دعوت:', error)
      return {
        code: '',
        link: '',
        totalReferrals: 0,
        totalEarnings: 0
      }
    }
  }
}

// ============================================
// 🔔 توابع نوتیفیکیشن - ساده شده
// ============================================

export const notificationsAPI = {
  // دریافت نوتیفیکیشن‌ها - ساده شده
  async getNotifications(userId, limit = 10) {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit)
      
      if (error) {
        console.warn('⚠️ خطا در دریافت نوتیفیکیشن‌ها:', error)
        return []
      }
      
      return data || []
      
    } catch (error) {
      console.error('❌ خطا در دریافت نوتیفیکیشن‌ها:', error)
      return []
    }
  }
}

// ============================================
// 🎯 توابع کمکی - اصلاح شده
// ============================================

export const utils = {
  // فرمت کردن اعداد
  formatNumber(num) {
    if (num === null || num === undefined) return '0'
    
    const numValue = Number(num)
    if (isNaN(numValue)) return '0'
    
    if (numValue >= 1000000) {
      return (numValue / 1000000).toFixed(2).replace(/\.00$/, '') + 'M'
    }
    if (numValue >= 1000) {
      return (numValue / 1000).toFixed(1).replace(/\.0$/, '') + 'K'
    }
    return numValue.toString()
  },
  
  // تست ویبره (اصلاح شده)
  vibrateTest() {
    // فقط بعد از کلیک کاربر ویبره کار می‌کند
    if (navigator.vibrate) {
      console.log('📳 ویبره در دسترس است')
      // ذخیره برای استفاده بعدی
      this.vibrateEnabled = true
    } else {
      console.log('⚠️ ویبره در این دستگاه پشتیبانی نمی‌شود')
    }
  },
  
  // ویبره (فقط بعد از تعامل کاربر)
  vibrate(pattern) {
    if (navigator.vibrate && this.vibrateEnabled) {
      try {
        navigator.vibrate(pattern)
      } catch (e) {
        console.warn('⚠️ خطا در ویبره:', e)
      }
    }
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
  utils
}
