import { X, Download, Building, Calendar, Mail, Phone } from 'lucide-react';

interface SalarySlipModalProps {
  onClose: () => void;
  month: string;
  year: string;
  employeeName: string;
  employeeCode: string;
  designation: string;
  department: string;
  employmentType: string;
  payoutData: any;
}

export default function SalarySlipModal({
  onClose,
  month,
  year,
  employeeName,
  employeeCode,
  designation,
  department,
  employmentType,
  payoutData,
}: SalarySlipModalProps) {
  const handleDownload = () => {
    // Trigger download logic
    console.log('Downloading salary slip...');
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">
            Salary Slip - {month} {year}
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={handleDownload}
              className="px-4 py-2 rounded-md text-sm font-medium text-white flex items-center gap-2"
              style={{ backgroundColor: '#2C3E7C' }}
            >
              <Download size={16} />
              Download PDF
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X size={20} className="text-gray-500" />
            </button>
          </div>
        </div>

        {/* Salary Slip Content */}
        <div className="p-8">
          {/* Company Header */}
          <div className="text-center mb-6 pb-6 border-b-2 border-gray-300">
            <div className="flex items-center justify-center gap-4 mb-3">
              <img
                src="/src/imports/Logo1new.png"
                alt="Centrum Academy"
                className="w-20 h-20 object-contain"
              />
              <div className="text-left">
                <h1 className="text-3xl font-bold text-gray-900">Centrum Academy</h1>
                <p className="text-sm text-gray-600 mt-1">Educational Institution</p>
              </div>
            </div>
            <p className="text-xs text-gray-600">
              123 Education Street, Bangalore, Karnataka 560001
            </p>
            <p className="text-xs text-gray-600">
              Email: hr@centrumacademy.com | Phone: +91 80 1234 5678
            </p>
          </div>

          {/* Slip Details */}
          <div className="grid grid-cols-2 gap-6 mb-6">
            {/* Employee Details */}
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-3 uppercase tracking-wide">
                Employee Details
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Name:</span>
                  <span className="font-medium text-gray-900">{employeeName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Employee Code:</span>
                  <span className="font-medium text-gray-900">{employeeCode}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Designation:</span>
                  <span className="font-medium text-gray-900">{designation}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Department:</span>
                  <span className="font-medium text-gray-900">{department}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Employment Type:</span>
                  <span className="font-medium text-gray-900">{employmentType}</span>
                </div>
              </div>
            </div>

            {/* Payment Details */}
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-3 uppercase tracking-wide">
                Payment Details
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Pay Period:</span>
                  <span className="font-medium text-gray-900">
                    {month} {year}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Payment Date:</span>
                  <span className="font-medium text-gray-900">{payoutData.paymentDate}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Payment Mode:</span>
                  <span className="font-medium text-gray-900">Bank Transfer</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Bank Account:</span>
                  <span className="font-medium text-gray-900">XXXX XXXX {payoutData.lastFourDigits || '1234'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Working Days:</span>
                  <span className="font-medium text-gray-900">
                    {payoutData.workingDays || 22} / {payoutData.totalDays || 22}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Earnings and Deductions Table */}
          <div className="border border-gray-300 rounded-lg overflow-hidden mb-6">
            <div className="grid grid-cols-2 bg-gray-100">
              <div className="p-3 border-r border-gray-300">
                <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
                  Earnings
                </h3>
              </div>
              <div className="p-3">
                <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
                  Deductions
                </h3>
              </div>
            </div>

            <div className="grid grid-cols-2">
              {/* Earnings Column */}
              <div className="border-r border-gray-300">
                <div className="divide-y divide-gray-200">
                  <div className="flex justify-between p-3 text-sm">
                    <span className="text-gray-700">Basic Salary</span>
                    <span className="font-medium text-gray-900">
                      ₹{payoutData.basicSalary?.toLocaleString('en-IN')}
                    </span>
                  </div>
                  <div className="flex justify-between p-3 text-sm">
                    <span className="text-gray-700">HRA</span>
                    <span className="font-medium text-gray-900">
                      ₹{payoutData.hra?.toLocaleString('en-IN')}
                    </span>
                  </div>
                  <div className="flex justify-between p-3 text-sm">
                    <span className="text-gray-700">Conveyance Allowance</span>
                    <span className="font-medium text-gray-900">
                      ₹{payoutData.conveyance?.toLocaleString('en-IN')}
                    </span>
                  </div>
                  <div className="flex justify-between p-3 text-sm">
                    <span className="text-gray-700">Medical Allowance</span>
                    <span className="font-medium text-gray-900">
                      ₹{payoutData.medical?.toLocaleString('en-IN')}
                    </span>
                  </div>
                  {payoutData.bonus > 0 && (
                    <div className="flex justify-between p-3 text-sm bg-green-50">
                      <span className="text-gray-700 font-medium">Bonus</span>
                      <span className="font-medium text-green-700">
                        ₹{payoutData.bonus?.toLocaleString('en-IN')}
                      </span>
                    </div>
                  )}
                  {payoutData.claims > 0 && (
                    <div className="flex justify-between p-3 text-sm bg-blue-50">
                      <span className="text-gray-700 font-medium">Claims Reimbursement</span>
                      <span className="font-medium text-blue-700">
                        ₹{payoutData.claims?.toLocaleString('en-IN')}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between p-3 text-sm bg-gray-100 font-semibold">
                    <span className="text-gray-900">Total Earnings</span>
                    <span className="text-gray-900">
                      ₹{payoutData.totalEarnings?.toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>
              </div>

              {/* Deductions Column */}
              <div>
                <div className="divide-y divide-gray-200">
                  <div className="flex justify-between p-3 text-sm">
                    <span className="text-gray-700">PF (Employee)</span>
                    <span className="font-medium text-gray-900">
                      ₹{payoutData.pfEmployee?.toLocaleString('en-IN')}
                    </span>
                  </div>
                  <div className="flex justify-between p-3 text-sm">
                    <span className="text-gray-700">Professional Tax</span>
                    <span className="font-medium text-gray-900">
                      ₹{payoutData.professionalTax?.toLocaleString('en-IN')}
                    </span>
                  </div>
                  <div className="flex justify-between p-3 text-sm">
                    <span className="text-gray-700">TDS / Income Tax</span>
                    <span className="font-medium text-gray-900">
                      ₹{payoutData.tds?.toLocaleString('en-IN')}
                    </span>
                  </div>
                  {payoutData.lop > 0 && (
                    <div className="flex justify-between p-3 text-sm bg-red-50">
                      <span className="text-gray-700 font-medium">Loss of Pay (LOP)</span>
                      <span className="font-medium text-red-600">
                        ₹{payoutData.lop?.toLocaleString('en-IN')}
                      </span>
                    </div>
                  )}
                  {payoutData.otherDeductions > 0 && (
                    <div className="flex justify-between p-3 text-sm">
                      <span className="text-gray-700">Other Deductions</span>
                      <span className="font-medium text-gray-900">
                        ₹{payoutData.otherDeductions?.toLocaleString('en-IN')}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between p-3 text-sm bg-gray-100 font-semibold">
                    <span className="text-gray-900">Total Deductions</span>
                    <span className="text-gray-900">
                      ₹{payoutData.totalDeductions?.toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Net Pay */}
          <div className="bg-gradient-to-r from-green-50 to-green-100 border-2 border-green-500 rounded-lg p-5 mb-6">
            <div className="flex items-center justify-between">
              <span className="text-lg font-semibold text-gray-900">Net Pay</span>
              <span className="text-3xl font-bold text-green-700">
                ₹{payoutData.netPay?.toLocaleString('en-IN')}
              </span>
            </div>
            <p className="text-xs text-gray-600 mt-2">
              In Words: <span className="font-medium">{payoutData.netPayInWords}</span>
            </p>
          </div>

          {/* Footer Note */}
          <div className="text-xs text-gray-500 text-center pt-4 border-t border-gray-300">
            <p>This is a computer-generated document and does not require a signature.</p>
            <p className="mt-1">
              For any queries, please contact HR at hr@centrumacademy.com
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
