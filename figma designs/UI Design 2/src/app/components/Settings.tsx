import { useState } from 'react';
import {
  User,
  Lock,
  Bell,
  Eye,
  EyeOff,
  Upload,
  Monitor,
  Globe,
  Shield,
  Mail,
  Phone,
  Clock,
  Calendar,
  Smartphone,
  Laptop,
  Save,
} from 'lucide-react';

export default function Settings() {
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [passwordData, setPasswordData] = useState({
    current: '',
    new: '',
    confirm: '',
  });

  const [notifications, setNotifications] = useState({
    emailNotices: true,
    emailLeaves: true,
    emailClaims: true,
    emailTasks: true,
    pushNotices: true,
    pushLeaves: false,
    pushClaims: false,
  });

  const [preferences, setPreferences] = useState({
    theme: 'light',
    language: 'en',
    dateFormat: 'DD/MM/YYYY',
    timeFormat: '12',
    timezone: 'Asia/Kolkata',
  });

  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-600 mt-1">Manage your account and preferences</p>
      </div>

      {/* Profile Section */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-5 flex items-center gap-2">
          <User size={20} style={{ color: '#2C3E7C' }} />
          Profile
        </h2>

        <div className="flex flex-col md:flex-row gap-6">
          {/* Profile Photo */}
          <div className="flex flex-col items-center gap-3">
            <div
              className="w-32 h-32 rounded-lg flex items-center justify-center text-white text-3xl font-medium"
              style={{ backgroundColor: '#2C3E7C' }}
            >
              SA
            </div>
            <button
              className="px-4 py-2 border border-gray-200 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-2"
            >
              <Upload size={16} />
              Upload photo
            </button>
            <p className="text-xs text-gray-500">JPG, PNG or WEBP · max 3 MB</p>
          </div>

          {/* Profile Details */}
          <div className="flex-1 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Full Name</label>
                <input
                  type="text"
                  defaultValue="System Administrator"
                  className="w-full px-4 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2"
                  style={{ focusRing: '#2C3E7C' }}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Employee ID
                </label>
                <input
                  type="text"
                  defaultValue="SA0001"
                  disabled
                  className="w-full px-4 py-2 border border-gray-200 rounded-md bg-gray-50 text-gray-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                <input
                  type="email"
                  defaultValue="admin@centrumacademy.com"
                  className="w-full px-4 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2"
                  style={{ focusRing: '#2C3E7C' }}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Phone</label>
                <input
                  type="tel"
                  defaultValue="+91 98765 43210"
                  className="w-full px-4 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2"
                  style={{ focusRing: '#2C3E7C' }}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Role</label>
              <input
                type="text"
                defaultValue="SUPER ADMIN"
                disabled
                className="w-full px-4 py-2 border border-gray-200 rounded-md bg-gray-50 text-gray-500"
              />
            </div>

            <div className="flex justify-end">
              <button
                className="px-4 py-2 rounded-md text-sm font-medium text-white flex items-center gap-2"
                style={{ backgroundColor: '#2C3E7C' }}
              >
                <Save size={16} />
                Save Profile
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Security Section */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-5 flex items-center gap-2">
          <Shield size={20} style={{ color: '#2C3E7C' }} />
          Security
        </h2>

        {/* Two-Factor Authentication */}
        <div className="mb-6 pb-6 border-b border-gray-200">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-gray-900 mb-1">
                Two-Factor Authentication
              </h3>
              <p className="text-sm text-gray-600">
                Add an extra layer of security to your account
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={twoFactorEnabled}
                onChange={(e) => setTwoFactorEnabled(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-offset-2 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>
        </div>

        {/* Change Password */}
        <div>
          <h3 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Lock size={18} />
            Change Password
          </h3>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Current Password
              </label>
              <div className="relative">
                <input
                  type={showCurrentPassword ? 'text' : 'password'}
                  value={passwordData.current}
                  onChange={(e) =>
                    setPasswordData({ ...passwordData, current: e.target.value })
                  }
                  className="w-full px-4 py-2 pr-10 border border-gray-200 rounded-md focus:outline-none focus:ring-2"
                  style={{ focusRing: '#2C3E7C' }}
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showCurrentPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">New Password</label>
              <div className="relative">
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  value={passwordData.new}
                  onChange={(e) => setPasswordData({ ...passwordData, new: e.target.value })}
                  className="w-full px-4 py-2 pr-10 border border-gray-200 rounded-md focus:outline-none focus:ring-2"
                  style={{ focusRing: '#2C3E7C' }}
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Confirm New Password
              </label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={passwordData.confirm}
                  onChange={(e) => setPasswordData({ ...passwordData, confirm: e.target.value })}
                  className="w-full px-4 py-2 pr-10 border border-gray-200 rounded-md focus:outline-none focus:ring-2"
                  style={{ focusRing: '#2C3E7C' }}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                className="px-4 py-2 rounded-md text-sm font-medium text-white"
                style={{ backgroundColor: '#2C3E7C' }}
              >
                Update Password
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Notification Preferences */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-5 flex items-center gap-2">
          <Bell size={20} style={{ color: '#2C3E7C' }} />
          Notification Preferences
        </h2>

        <div className="space-y-6">
          {/* Email Notifications */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <Mail size={16} />
              Email Notifications
            </h3>
            <div className="space-y-3 ml-6">
              <label className="flex items-center justify-between">
                <span className="text-sm text-gray-700">Notice Board updates</span>
                <input
                  type="checkbox"
                  checked={notifications.emailNotices}
                  onChange={(e) =>
                    setNotifications({ ...notifications, emailNotices: e.target.checked })
                  }
                  className="w-4 h-4 rounded border-gray-300 focus:ring-2"
                  style={{ accentColor: '#2C3E7C' }}
                />
              </label>
              <label className="flex items-center justify-between">
                <span className="text-sm text-gray-700">Leave requests and approvals</span>
                <input
                  type="checkbox"
                  checked={notifications.emailLeaves}
                  onChange={(e) =>
                    setNotifications({ ...notifications, emailLeaves: e.target.checked })
                  }
                  className="w-4 h-4 rounded border-gray-300 focus:ring-2"
                  style={{ accentColor: '#2C3E7C' }}
                />
              </label>
              <label className="flex items-center justify-between">
                <span className="text-sm text-gray-700">Claim requests and approvals</span>
                <input
                  type="checkbox"
                  checked={notifications.emailClaims}
                  onChange={(e) =>
                    setNotifications({ ...notifications, emailClaims: e.target.checked })
                  }
                  className="w-4 h-4 rounded border-gray-300 focus:ring-2"
                  style={{ accentColor: '#2C3E7C' }}
                />
              </label>
              <label className="flex items-center justify-between">
                <span className="text-sm text-gray-700">Task assignments and updates</span>
                <input
                  type="checkbox"
                  checked={notifications.emailTasks}
                  onChange={(e) =>
                    setNotifications({ ...notifications, emailTasks: e.target.checked })
                  }
                  className="w-4 h-4 rounded border-gray-300 focus:ring-2"
                  style={{ accentColor: '#2C3E7C' }}
                />
              </label>
            </div>
          </div>

          {/* Push Notifications */}
          <div className="pt-4 border-t border-gray-200">
            <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <Smartphone size={16} />
              Push Notifications
            </h3>
            <div className="space-y-3 ml-6">
              <label className="flex items-center justify-between">
                <span className="text-sm text-gray-700">Notice Board updates</span>
                <input
                  type="checkbox"
                  checked={notifications.pushNotices}
                  onChange={(e) =>
                    setNotifications({ ...notifications, pushNotices: e.target.checked })
                  }
                  className="w-4 h-4 rounded border-gray-300 focus:ring-2"
                  style={{ accentColor: '#2C3E7C' }}
                />
              </label>
              <label className="flex items-center justify-between">
                <span className="text-sm text-gray-700">Leave requests and approvals</span>
                <input
                  type="checkbox"
                  checked={notifications.pushLeaves}
                  onChange={(e) =>
                    setNotifications({ ...notifications, pushLeaves: e.target.checked })
                  }
                  className="w-4 h-4 rounded border-gray-300 focus:ring-2"
                  style={{ accentColor: '#2C3E7C' }}
                />
              </label>
              <label className="flex items-center justify-between">
                <span className="text-sm text-gray-700">Claim requests and approvals</span>
                <input
                  type="checkbox"
                  checked={notifications.pushClaims}
                  onChange={(e) =>
                    setNotifications({ ...notifications, pushClaims: e.target.checked })
                  }
                  className="w-4 h-4 rounded border-gray-300 focus:ring-2"
                  style={{ accentColor: '#2C3E7C' }}
                />
              </label>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              className="px-4 py-2 rounded-md text-sm font-medium text-white flex items-center gap-2"
              style={{ backgroundColor: '#2C3E7C' }}
            >
              <Save size={16} />
              Save Preferences
            </button>
          </div>
        </div>
      </div>

      {/* Display Preferences */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-5 flex items-center gap-2">
          <Monitor size={20} style={{ color: '#2C3E7C' }} />
          Display Preferences
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
              <Laptop size={16} />
              Theme
            </label>
            <select
              value={preferences.theme}
              onChange={(e) => setPreferences({ ...preferences, theme: e.target.value })}
              className="w-full px-4 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2"
              style={{ focusRing: '#2C3E7C' }}
            >
              <option value="light">Light</option>
              <option value="dark">Dark</option>
              <option value="auto">Auto (System)</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
              <Globe size={16} />
              Language
            </label>
            <select
              value={preferences.language}
              onChange={(e) => setPreferences({ ...preferences, language: e.target.value })}
              className="w-full px-4 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2"
              style={{ focusRing: '#2C3E7C' }}
            >
              <option value="en">English</option>
              <option value="hi">Hindi</option>
              <option value="mr">Marathi</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
              <Calendar size={16} />
              Date Format
            </label>
            <select
              value={preferences.dateFormat}
              onChange={(e) => setPreferences({ ...preferences, dateFormat: e.target.value })}
              className="w-full px-4 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2"
              style={{ focusRing: '#2C3E7C' }}
            >
              <option value="DD/MM/YYYY">DD/MM/YYYY</option>
              <option value="MM/DD/YYYY">MM/DD/YYYY</option>
              <option value="YYYY-MM-DD">YYYY-MM-DD</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
              <Clock size={16} />
              Time Format
            </label>
            <select
              value={preferences.timeFormat}
              onChange={(e) => setPreferences({ ...preferences, timeFormat: e.target.value })}
              className="w-full px-4 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2"
              style={{ focusRing: '#2C3E7C' }}
            >
              <option value="12">12-hour (AM/PM)</option>
              <option value="24">24-hour</option>
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
              <Globe size={16} />
              Timezone
            </label>
            <select
              value={preferences.timezone}
              onChange={(e) => setPreferences({ ...preferences, timezone: e.target.value })}
              className="w-full px-4 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2"
              style={{ focusRing: '#2C3E7C' }}
            >
              <option value="Asia/Kolkata">India Standard Time (IST)</option>
              <option value="America/New_York">Eastern Time (ET)</option>
              <option value="America/Los_Angeles">Pacific Time (PT)</option>
              <option value="Europe/London">Greenwich Mean Time (GMT)</option>
              <option value="Asia/Dubai">Gulf Standard Time (GST)</option>
            </select>
          </div>
        </div>

        <div className="flex justify-end pt-4">
          <button
            className="px-4 py-2 rounded-md text-sm font-medium text-white flex items-center gap-2"
            style={{ backgroundColor: '#2C3E7C' }}
          >
            <Save size={16} />
            Save Preferences
          </button>
        </div>
      </div>

      {/* Active Sessions */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-5 flex items-center gap-2">
          <Laptop size={20} style={{ color: '#2C3E7C' }} />
          Active Sessions
        </h2>

        <div className="space-y-3">
          <div className="flex items-start justify-between p-4 bg-gray-50 rounded-lg">
            <div className="flex items-start gap-3">
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: '#2C3E7C' }}
              >
                <Laptop className="text-white" size={18} />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">Windows • Chrome</p>
                <p className="text-xs text-gray-600">Mumbai, India • Last active: Now</p>
                <p className="text-xs text-green-600 mt-1 font-medium">Current Session</p>
              </div>
            </div>
          </div>

          <div className="flex items-start justify-between p-4 bg-gray-50 rounded-lg">
            <div className="flex items-start gap-3">
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center bg-gray-300"
              >
                <Smartphone className="text-white" size={18} />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">iPhone • Safari</p>
                <p className="text-xs text-gray-600">Mumbai, India • Last active: 2 hours ago</p>
              </div>
            </div>
            <button className="text-xs text-red-600 hover:text-red-700 font-medium">
              Revoke
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
