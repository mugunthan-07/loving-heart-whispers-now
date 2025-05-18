
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";

interface AttendanceRecord {
  id: string;
  timestamp: number;
  type: "check-in" | "check-out";
  status: "present" | "absent";
  location: {
    latitude: number;
    longitude: number;
  };
  photoUrl?: string;
}

const History = () => {
  const [currentUser, setCurrentUser] = useState<{ id: string; name: string } | null>(null);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    // Check if user is logged in
    const storedUser = localStorage.getItem("currentUser");
    if (!storedUser) {
      navigate("/");
      return;
    }
    setCurrentUser(JSON.parse(storedUser));

    // Load attendance records from localStorage
    const storedRecords = localStorage.getItem("attendanceRecords");
    if (storedRecords) {
      const records = JSON.parse(storedRecords);
      const userRecords = records.filter(
        (r: AttendanceRecord) => r.id === JSON.parse(storedUser).id
      );
      setAttendanceRecords(userRecords);
    }
  }, [navigate]);

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const goToAttendance = () => {
    navigate("/attendance");
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Attendance History</h1>
          <Button onClick={goToAttendance}>Back to Attendance</Button>
        </div>

        {currentUser && (
          <div className="bg-white rounded-lg shadow p-4 mb-4">
            <p className="text-lg font-medium">
              Attendance Records for {currentUser.name}
            </p>
          </div>
        )}

        <div className="bg-white rounded-lg shadow overflow-hidden">
          {attendanceRecords.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date & Time</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Photo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {attendanceRecords
                  .sort((a, b) => b.timestamp - a.timestamp)
                  .map((record, index) => (
                    <TableRow key={index}>
                      <TableCell>{formatDate(record.timestamp)}</TableCell>
                      <TableCell>
                        <span className={`inline-block px-2 py-1 rounded text-xs ${
                          record.type === "check-in" ? "bg-green-100 text-green-800" : "bg-blue-100 text-blue-800"
                        }`}>
                          {record.type === "check-in" ? "Check In" : "Check Out"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className={`inline-block px-2 py-1 rounded text-xs ${
                          record.status === "present" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                        }`}>
                          {record.status === "present" ? "Present" : "Absent"}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs">
                        Lat: {record.location.latitude.toFixed(6)}<br />
                        Lng: {record.location.longitude.toFixed(6)}
                      </TableCell>
                      <TableCell>
                        {record.photoUrl ? (
                          <img 
                            src={record.photoUrl} 
                            alt="Attendance photo" 
                            className="w-12 h-12 object-cover rounded"
                          />
                        ) : (
                          <span className="text-xs text-gray-500">No photo</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          ) : (
            <div className="p-8 text-center text-gray-500">
              No attendance records found
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default History;
