import { Clock, MapPin, Video, Users } from 'lucide-react';

export default function UpcomingClasses() {
  const classes = [
    {
      subject: 'Advanced Mathematics',
      teacher: 'Dr. Sarah Mitchell',
      time: '11:00 AM - 12:30 PM',
      room: 'Room 204',
      type: 'In-Person',
      color: 'bg-blue-500',
      students: 28,
    },
    {
      subject: 'Physics Laboratory',
      teacher: 'Prof. James Wilson',
      time: '2:00 PM - 3:30 PM',
      room: 'Lab 3',
      type: 'In-Person',
      color: 'bg-green-500',
      students: 24,
    },
    {
      subject: 'English Literature',
      teacher: 'Ms. Emily Parker',
      time: '4:00 PM - 5:00 PM',
      room: 'Online',
      type: 'Virtual',
      color: 'bg-purple-500',
      students: 32,
    },
  ];

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-lg font-bold text-gray-900">Today's Classes</h3>
        <button className="text-sm text-blue-600 hover:text-blue-700 font-medium">
          View All
        </button>
      </div>
      <div className="space-y-4">
        {classes.map((classItem, index) => (
          <div
            key={index}
            className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors border border-gray-100"
          >
            <div className={`${classItem.color} w-1 h-full rounded-full`}></div>
            <div className="flex-1">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h4 className="font-semibold text-gray-900">{classItem.subject}</h4>
                  <p className="text-sm text-gray-600">{classItem.teacher}</p>
                </div>
                {classItem.type === 'Virtual' ? (
                  <span className="flex items-center gap-1 px-3 py-1 bg-purple-100 text-purple-700 text-xs font-medium rounded-full">
                    <Video size={12} />
                    Virtual
                  </span>
                ) : (
                  <span className="px-3 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                    In-Person
                  </span>
                )}
              </div>
              <div className="flex items-center gap-4 text-sm text-gray-500">
                <span className="flex items-center gap-1">
                  <Clock size={14} />
                  {classItem.time}
                </span>
                <span className="flex items-center gap-1">
                  <MapPin size={14} />
                  {classItem.room}
                </span>
                <span className="flex items-center gap-1">
                  <Users size={14} />
                  {classItem.students} students
                </span>
              </div>
            </div>
            <button className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors">
              Join
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
