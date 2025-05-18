
import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { MapPin, Camera, Clock } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "@/components/ui/sonner";

// Define the office location (should be replaced with actual coordinates)
const OFFICE_LOCATION = {
  latitude: 40.7128, // Example: New York City
  longitude: -74.0060
};

// Maximum distance from office (in meters) to be considered present
const MAX_DISTANCE = 100;

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

const Attendance = () => {
  const [currentUser, setCurrentUser] = useState<{ id: string; name: string } | null>(null);
  const [currentLocation, setCurrentLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [distance, setDistance] = useState<number | null>(null);
  const [isWithinOffice, setIsWithinOffice] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasCheckedIn, setHasCheckedIn] = useState(false);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
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
      setAttendanceRecords(records);
      
      // Check if user has already checked in today
      const today = new Date().toDateString();
      const userRecords = records.filter((r: AttendanceRecord) => {
        const recordDate = new Date(r.timestamp).toDateString();
        return r.id === JSON.parse(storedUser).id && recordDate === today && r.type === "check-in";
      });
      
      setHasCheckedIn(userRecords.length > 0);
    }

    // Get current location
    getCurrentLocation();
  }, [navigate]);

  const getCurrentLocation = () => {
    setIsLoading(true);
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setCurrentLocation({ latitude, longitude });
          
          // Calculate distance from office
          const dist = calculateDistance(
            latitude,
            longitude,
            OFFICE_LOCATION.latitude,
            OFFICE_LOCATION.longitude
          );
          
          setDistance(dist);
          setIsWithinOffice(dist <= MAX_DISTANCE);
          setIsLoading(false);
        },
        (error) => {
          console.error("Error getting location:", error);
          toast.error("Failed to get your location. Please enable location services.");
          setIsLoading(false);
        },
        { enableHighAccuracy: true }
      );
    } else {
      toast.error("Geolocation is not supported by your browser");
      setIsLoading(false);
    }
  };

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;

    return Math.round(distance); // Distance in meters
  };

  const startCamera = async () => {
    try {
      if (!videoRef.current) return;

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: false,
      });
      
      videoRef.current.srcObject = stream;
      setIsCameraActive(true);
    } catch (err) {
      console.error("Error accessing camera:", err);
      toast.error("Failed to access camera. Please check your permissions.");
    }
  };

  const stopCamera = () => {
    if (!videoRef.current || !videoRef.current.srcObject) return;
    
    const stream = videoRef.current.srcObject as MediaStream;
    const tracks = stream.getTracks();
    
    tracks.forEach(track => track.stop());
    videoRef.current.srcObject = null;
    setIsCameraActive(false);
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return null;
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");
    
    if (!context) return null;
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    return canvas.toDataURL("image/jpeg");
  };

  const handleAttendance = (type: "check-in" | "check-out") => {
    if (!currentUser || !currentLocation) return;

    // Take photo if camera is active
    let photoUrl;
    if (isCameraActive) {
      photoUrl = capturePhoto();
      stopCamera();
    }

    // Create attendance record
    const newRecord: AttendanceRecord = {
      id: currentUser.id,
      timestamp: Date.now(),
      type,
      status: isWithinOffice ? "present" : "absent",
      location: currentLocation,
      photoUrl
    };

    // Update records
    const updatedRecords = [...attendanceRecords, newRecord];
    setAttendanceRecords(updatedRecords);
    
    // Save to localStorage (in a real app, this would go to a server)
    localStorage.setItem("attendanceRecords", JSON.stringify(updatedRecords));

    // Update UI
    if (type === "check-in") {
      setHasCheckedIn(true);
      if (isWithinOffice) {
        toast.success("You have been marked present");
      } else {
        toast.warning("You are outside the office. Marked as absent.");
      }
    } else {
      setHasCheckedIn(false);
      toast.success("You have checked out successfully");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("currentUser");
    navigate("/");
  };

  const viewHistory = () => {
    navigate("/history");
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-md mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Attendance System</h1>
          <div className="space-x-2">
            <Button variant="outline" onClick={viewHistory}>History</Button>
            <Button variant="outline" onClick={handleLogout}>Logout</Button>
          </div>
        </div>

        {currentUser && (
          <div className="bg-white rounded-lg shadow p-4 mb-4">
            <p className="text-lg font-medium">Welcome, {currentUser.name}</p>
            <p className="text-sm text-gray-500">Employee ID: {currentUser.id}</p>
          </div>
        )}

        <div className="bg-white rounded-lg shadow p-4 mb-4">
          <h2 className="text-lg font-medium mb-2">Location Status</h2>
          
          {isLoading ? (
            <p className="text-gray-600">Determining your location...</p>
          ) : (
            <>
              {currentLocation ? (
                <div className="space-y-2">
                  <p className="flex items-center">
                    <MapPin className="mr-2 h-4 w-4" />
                    <span>Lat: {currentLocation.latitude.toFixed(6)}, Long: {currentLocation.longitude.toFixed(6)}</span>
                  </p>
                  
                  {distance !== null && (
                    <p className="text-sm">
                      Distance from office: {distance} meters
                    </p>
                  )}
                  
                  {isWithinOffice !== null && (
                    <Alert className={isWithinOffice ? "bg-green-50" : "bg-red-50"}>
                      <AlertDescription>
                        {isWithinOffice 
                          ? "You are within office premises. You can mark attendance." 
                          : "You are outside office premises. Attendance will be marked as absent."}
                      </AlertDescription>
                    </Alert>
                  )}
                  
                  <Button onClick={getCurrentLocation} variant="outline" size="sm" className="mt-2">
                    Refresh Location
                  </Button>
                </div>
              ) : (
                <p className="text-red-500">Unable to determine your location</p>
              )}
            </>
          )}
        </div>

        <div className="bg-white rounded-lg shadow p-4 mb-4">
          <h2 className="text-lg font-medium mb-2">Camera</h2>
          
          <div className="relative aspect-video bg-gray-100 mb-2 rounded overflow-hidden">
            {isCameraActive ? (
              <video 
                ref={videoRef} 
                autoPlay 
                playsInline 
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="flex items-center justify-center h-full">
                <Camera className="h-10 w-10 text-gray-400" />
              </div>
            )}
            <canvas ref={canvasRef} className="hidden" />
          </div>
          
          <Button 
            onClick={isCameraActive ? stopCamera : startCamera} 
            variant="outline"
            className="w-full"
          >
            {isCameraActive ? "Stop Camera" : "Start Camera"}
          </Button>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <h2 className="text-lg font-medium mb-4">Mark Attendance</h2>
          
          <div className="grid grid-cols-2 gap-4">
            <Button
              onClick={() => handleAttendance("check-in")}
              disabled={hasCheckedIn || isLoading}
              className="flex items-center justify-center"
            >
              <Clock className="mr-2 h-4 w-4" />
              Check In
            </Button>
            
            <Button
              onClick={() => handleAttendance("check-out")}
              disabled={!hasCheckedIn || isLoading}
              variant="outline"
              className="flex items-center justify-center"
            >
              <Clock className="mr-2 h-4 w-4" />
              Check Out
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Attendance;
