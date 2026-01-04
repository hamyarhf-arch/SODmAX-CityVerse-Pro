// supabase-manager.js
class SupabaseManager {
    constructor() {
        this.supabase = window.supabaseClient;
    }

    // ================ کاربران ================
    async getUserByPhone(phone) {
        const { data, error } = await this.supabase
            .from('users')
            .select('*')
            .eq('phone', phone)
            .single();
        return { data, error };
    }

    async createUser(userData) {
        const { data, error } = await this.supabase
            .from('users')
            .insert([userData])
            .select()
            .single();
        return { data, error };
    }

    async updateUser(userId, updates) {
        const { data, error } = await this.supabase
            .from('users')
            .update(updates)
            .eq('id', userId)
            .select()
            .single();
        return { data, error };
    }

    async getUserById(userId) {
        const { data, error } = await this.supabase
            .from('users')
            .select('*')
            .eq('id', userId)
            .single();
        return { data, error };
    }

    async getAllUsers() {
        const { data, error } = await this.supabase
            .from('users')
            .select('*');
        return { data, error };
    }

    // ================ تراکنش‌ها ================
    async getTransactions(userId) {
        const { data, error } = await this.supabase
            .from('transactions')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });
        return { data, error };
    }

    async addTransaction(transactionData) {
        const { data, error } = await this.supabase
            .from('transactions')
            .insert([transactionData])
            .select()
            .single();
        return { data, error };
    }

    // ================ نوتیفیکیشن‌ها ================
    async getNotifications(userId) {
        const { data, error } = await this.supabase
            .from('notifications')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });
        return { data, error };
    }

    async addNotification(notificationData) {
        const { data, error } = await this.supabase
            .from('notifications')
            .insert([notificationData])
            .select()
            .single();
        return { data, error };
    }

    async markNotificationAsRead(notificationId) {
        const { data, error } = await this.supabase
            .from('notifications')
            .update({ read: true })
            .eq('id', notificationId)
            .select()
            .single();
        return { data, error };
    }

    // ================ دعوت‌ها ================
    async getReferrals(userId) {
        const { data, error } = await this.supabase
            .from('referrals')
            .select('*')
            .eq('user_id', userId)
            .single();
        return { data, error };
    }

    async createReferrals(referralData) {
        const { data, error } = await this.supabase
            .from('referrals')
            .insert([referralData])
            .select()
            .single();
        return { data, error };
    }

    async updateReferrals(referralId, updates) {
        const { data, error } = await this.supabase
            .from('referrals')
            .update(updates)
            .eq('id', referralId)
            .select()
            .single();
        return { data, error };
    }

    // ================ توابع کمکی ================
    async checkReferralCodeExists(code) {
        const { data, error } = await this.supabase
            .from('users')
            .select('id, name, phone')
            .eq('referral_code', code)
            .single();
        return { data, error };
    }
}

// Export
window.SupabaseManager = SupabaseManager;
