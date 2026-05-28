import { useState } from 'react';
import {
  X,
  Plus,
  Upload,
  Download,
  Calendar,
  Trash2,
  Pencil,
  FileText,
  AlertCircle,
} from 'lucide-react';
import AddHolidayModal from './AddHolidayModal';

interface HolidayCalendarProps {
  isAdmin?: boolean;
  onClose: () => void;
}

export default function HolidayCalendar({ isAdmin = true, onClose }: HolidayCalendarProps) {
  const [selectedYear, setSelectedYear] = useState('2026-27');
  const [showAddHoliday, setShowAddHoliday] = useState(false);
  const [holidays, setHolidays] = useState<any[]>([
    // Example holidays
    {
      id: 1,
      name: 'Republic Day',
      fromDate: '2026-01-26',
      toDate: '2026-01-26',
      days: 1,
    },
    {
      id: 2,
      name: 'Diwali',
      fromDate: '2026-11-05',
      toDate: '2026-11-06',
      days: 2,
    },
  ]);

  const academicYears = ['2025-26', '2026-27', '2027-28'];

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      // Handle Excel file upload
      console.log('Uploading file:', e.target.files[0]);
      // In real implementation, parse Excel and add holidays
    }
  };

  const downloadTemplate = () => {
    // In real implementation, generate and download Excel template
    console.log('Downloading template');
  };

  const deleteHoliday = (id: number) => {
    setHolidays(holidays.filter(h => h.id !== id));
  };

  const getDayName = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { weekday: 'short' });
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-2xl font-semibold text-gray-900">Holiday Calendar</h2>
            <p className="text-sm text-gray-500 mt-1">
              {isAdmin
                ? 'Official holidays for 2026. Manage the list below.'
                : 'View official holidays for the academic year.'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        {/* Year Tabs and Actions */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            {/* Year Tabs */}
            <div className="flex gap-2">
              {academicYears.map((year) => (
                <button
                  key={year}
                  onClick={() => setSelectedYear(year)}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    selectedYear === year
                      ? 'text-white'
                      : 'text-gray-700 bg-gray-100 hover:bg-gray-200'
                  }`}
                  style={selectedYear === year ? { backgroundColor: '#2C3E7C' } : {}}
                >
                  {year}
                </button>
              ))}
            </div>

            {/* Admin Actions */}
            {isAdmin && (
              <div className="flex gap-2">
                <label className="cursor-pointer">
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <div className="px-4 py-2 border border-gray-200 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                    <Upload size={18} />
                    Upload from Excel
                  </div>
                </label>

                <button
                  onClick={downloadTemplate}
                  className="px-4 py-2 border border-gray-200 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                >
                  <Download size={18} />
                  Download Template
                </button>

                <button
                  onClick={() => setShowAddHoliday(true)}
                  className="px-4 py-2 rounded-md text-sm font-medium text-white flex items-center gap-2"
                  style={{ backgroundColor: '#2C3E7C' }}
                >
                  <Plus size={18} />
                  Add Holiday
                </button>
              </div>
            )}
          </div>

          {/* Excel Upload Info */}
          {isAdmin && (
            <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-start gap-2">
              <FileText className="text-blue-600 flex-shrink-0 mt-0.5" size={16} />
              <p className="text-xs text-blue-900">
                Download the Excel template, fill in holiday details, and upload to add multiple
                holidays at once. Template includes: Holiday Name, From Date, To Date.
              </p>
            </div>
          )}
        </div>

        {/* Holiday List */}
        <div className="p-6">
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            {/* Table Header */}
            <div className="px-6 py-4" style={{ backgroundColor: '#2C3E7C' }}>
              <h3 className="text-base font-semibold text-white text-center">
                EMPLOYEES' HOLIDAY LIST — {selectedYear.toUpperCase()}
              </h3>
            </div>

            {/* Table */}
            {holidays.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Holiday
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider border-l border-gray-200">
                        From
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider border-l border-gray-200">
                        To
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider border-l border-gray-200">
                        No. of Days
                      </th>
                      {isAdmin && (
                        <th className="px-6 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider border-l border-gray-200">
                          Actions
                        </th>
                      )}
                    </tr>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="px-6 py-2"></th>
                      <th className="px-6 py-2 border-l border-gray-200">
                        <div className="grid grid-cols-2 gap-2 text-xs font-semibold text-gray-600 uppercase">
                          <span>Date</span>
                          <span>Day</span>
                        </div>
                      </th>
                      <th className="px-6 py-2 border-l border-gray-200">
                        <div className="grid grid-cols-2 gap-2 text-xs font-semibold text-gray-600 uppercase">
                          <span>Date</span>
                          <span>Day</span>
                        </div>
                      </th>
                      <th className="px-6 py-2 border-l border-gray-200"></th>
                      {isAdmin && <th className="px-6 py-2 border-l border-gray-200"></th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {holidays.map((holiday) => (
                      <tr key={holiday.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 text-sm font-medium text-gray-900">
                          {holiday.name}
                        </td>
                        <td className="px-6 py-4 border-l border-gray-200">
                          <div className="grid grid-cols-2 gap-2 text-sm text-gray-700 text-center">
                            <span>{formatDate(holiday.fromDate)}</span>
                            <span className="text-gray-500">{getDayName(holiday.fromDate)}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 border-l border-gray-200">
                          <div className="grid grid-cols-2 gap-2 text-sm text-gray-700 text-center">
                            <span>{formatDate(holiday.toDate)}</span>
                            <span className="text-gray-500">{getDayName(holiday.toDate)}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900 text-center font-medium border-l border-gray-200">
                          {holiday.days}
                        </td>
                        {isAdmin && (
                          <td className="px-6 py-4 text-center border-l border-gray-200">
                            <div className="flex items-center justify-center gap-2">
                              <button className="p-1.5 hover:bg-gray-100 rounded text-gray-400 hover:text-blue-600">
                                <Pencil size={16} />
                              </button>
                              <button
                                onClick={() => deleteHoliday(holiday.id)}
                                className="p-1.5 hover:bg-gray-100 rounded text-gray-400 hover:text-red-600"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-12 text-center">
                <Calendar className="mx-auto text-gray-300 mb-4" size={48} />
                <p className="text-base font-medium text-gray-900 mb-1">
                  No holidays declared for {selectedYear.split('-')[0]}.
                </p>
                <p className="text-sm text-gray-500">
                  {isAdmin
                    ? 'Use "Add Holiday" to declare the first one.'
                    : 'Please check back later for holiday updates.'}
                </p>
              </div>
            )}
          </div>

          {/* Total Count */}
          {holidays.length > 0 && (
            <div className="mt-4 flex items-center justify-between px-4">
              <p className="text-sm text-gray-600">
                Total Holidays: <span className="font-semibold text-gray-900">{holidays.length}</span>
              </p>
              <p className="text-sm text-gray-600">
                Total Days: <span className="font-semibold text-gray-900">
                  {holidays.reduce((sum, h) => sum + h.days, 0)}
                </span>
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 bg-white"
          >
            Close
          </button>
          {isAdmin && holidays.length > 0 && (
            <button
              className="px-4 py-2 rounded-lg text-sm font-medium text-white"
              style={{ backgroundColor: '#2C3E7C' }}
            >
              <Download size={16} className="inline mr-2" />
              Export to PDF
            </button>
          )}
        </div>
      </div>

      {/* Add Holiday Modal */}
      {showAddHoliday && (
        <AddHolidayModal
          onClose={() => setShowAddHoliday(false)}
          onAdd={(holiday) => {
            setHolidays([...holidays, { ...holiday, id: holidays.length + 1 }]);
            setShowAddHoliday(false);
          }}
        />
      )}
    </div>
  );
}
