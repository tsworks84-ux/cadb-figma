import { useState } from 'react';
import { X, Calendar, Upload, File, AlertCircle } from 'lucide-react';

interface AddQualificationModalProps {
  onClose: () => void;
  onAdd: (qualification: any) => void;
}

export default function AddQualificationModal({ onClose, onAdd }: AddQualificationModalProps) {
  const [qualificationData, setQualificationData] = useState({
    level: '',
    degree: '',
    specialization: '',
    institution: '',
    university: '',
    yearOfPassing: '',
    percentage: '',
    certificate: null as File | null,
  });

  const levels = ['UG', 'PG', 'Diploma', 'PhD', 'Other'];

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setQualificationData({ ...qualificationData, certificate: e.target.files[0] });
    }
  };

  const handleSubmit = () => {
    onAdd(qualificationData);
    onClose();
  };

  const isMandatoryLevel = qualificationData.level === 'UG' || qualificationData.level === 'PG';
  const isFormValid =
    qualificationData.level &&
    qualificationData.degree &&
    qualificationData.institution &&
    qualificationData.yearOfPassing &&
    (!isMandatoryLevel || qualificationData.certificate);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Add Qualification</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {/* Level */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Level <span className="text-red-600">*</span>
            </label>
            <select
              value={qualificationData.level}
              onChange={(e) => setQualificationData({ ...qualificationData, level: e.target.value })}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2"
              style={{ focusRing: '#2C3E7C' }}
            >
              <option value="">Select level</option>
              {levels.map((level) => (
                <option key={level} value={level}>
                  {level}
                </option>
              ))}
            </select>
          </div>

          {/* Degree and Specialization */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Degree <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g., B.Sc, M.A, B.Tech"
                value={qualificationData.degree}
                onChange={(e) => setQualificationData({ ...qualificationData, degree: e.target.value })}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2"
                style={{ focusRing: '#2C3E7C' }}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Specialization
              </label>
              <input
                type="text"
                placeholder="e.g., Mathematics, Computer Science"
                value={qualificationData.specialization}
                onChange={(e) => setQualificationData({ ...qualificationData, specialization: e.target.value })}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2"
                style={{ focusRing: '#2C3E7C' }}
              />
            </div>
          </div>

          {/* Institution and University */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Institution <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                placeholder="Institution name"
                value={qualificationData.institution}
                onChange={(e) => setQualificationData({ ...qualificationData, institution: e.target.value })}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2"
                style={{ focusRing: '#2C3E7C' }}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                University/Board
              </label>
              <input
                type="text"
                placeholder="University or board name"
                value={qualificationData.university}
                onChange={(e) => setQualificationData({ ...qualificationData, university: e.target.value })}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2"
                style={{ focusRing: '#2C3E7C' }}
              />
            </div>
          </div>

          {/* Year and Percentage */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                <Calendar size={16} />
                Year of Passing <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g., 2020"
                value={qualificationData.yearOfPassing}
                onChange={(e) => setQualificationData({ ...qualificationData, yearOfPassing: e.target.value })}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2"
                style={{ focusRing: '#2C3E7C' }}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Percentage/CGPA
              </label>
              <input
                type="text"
                placeholder="e.g., 85% or 8.5 CGPA"
                value={qualificationData.percentage}
                onChange={(e) => setQualificationData({ ...qualificationData, percentage: e.target.value })}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2"
                style={{ focusRing: '#2C3E7C' }}
              />
            </div>
          </div>

          {/* Certificate Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
              <Upload size={16} />
              Certificate {isMandatoryLevel && <span className="text-red-600">*</span>}
              {isMandatoryLevel && (
                <span className="text-xs text-red-600 font-normal">(Mandatory for UG/PG)</span>
              )}
            </label>

            {!qualificationData.certificate ? (
              <label className="block cursor-pointer">
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <div className="flex flex-col items-center justify-center gap-2 px-4 py-8 border-2 border-dashed border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                  <Upload size={32} className="text-gray-400" />
                  <p className="text-sm font-medium text-gray-700">
                    Click to upload certificate
                  </p>
                  <p className="text-xs text-gray-500">PDF, JPG, or PNG (Max 5MB)</p>
                </div>
              </label>
            ) : (
              <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <File size={24} className="text-gray-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {qualificationData.certificate.name}
                    </p>
                    <p className="text-xs text-gray-500">
                      {(qualificationData.certificate.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setQualificationData({ ...qualificationData, certificate: null })}
                  className="p-2 hover:bg-gray-200 rounded text-gray-400 hover:text-red-600"
                >
                  <X size={18} />
                </button>
              </div>
            )}
          </div>

          {/* Info Note */}
          {isMandatoryLevel && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 flex items-start gap-2">
              <AlertCircle className="text-orange-600 flex-shrink-0 mt-0.5" size={16} />
              <p className="text-xs text-orange-900">
                Certificate upload is mandatory for UG (Undergraduate) and PG (Postgraduate) qualifications.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!isFormValid}
            className={`px-4 py-2 rounded-lg text-sm font-medium text-white ${
              !isFormValid ? 'bg-gray-300 cursor-not-allowed' : 'hover:opacity-90'
            }`}
            style={isFormValid ? { backgroundColor: '#2C3E7C' } : {}}
          >
            Add Qualification
          </button>
        </div>
      </div>
    </div>
  );
}
