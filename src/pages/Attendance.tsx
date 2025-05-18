import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { MapPin, Camera, Clock } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "@/components/ui/sonner";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

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
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
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

    // Cleanup camera when component unmounts
    return () => {
      stopCamera();
    };
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
    setCameraError(null);
    try {
      if (!videoRef.current) {
        console.error("Video reference not available");
        return;
      }

      // Request camera permissions with clear constraints
      const constraints = {
        video: { 
          facingMode: "user",
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false,
      };
      
      console.log("Requesting camera access with constraints:", constraints);
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          if (videoRef.current) {
            videoRef.current.play()
              .catch(e => {
                console.error("Error playing video:", e);
                setCameraError("Failed to start camera playback");
              });
          }
        };
        setIsCameraActive(true);
        toast.success("Camera access granted");
      }
    } catch (err) {
      console.error("Error accessing camera:", err);
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      setCameraError(`Camera access denied: ${errorMessage}`);
      toast.error("Failed to access camera. Please check your permissions.");
    }
  };

  const stopCamera = () => {
    if (!videoRef.current || !videoRef.current.srcObject) return;
    
    try {
      const stream = videoRef.current.srcObject as MediaStream;
      const tracks = stream.getTracks();
      
      tracks.forEach(track => track.stop());
      videoRef.current.srcObject = null;
      setIsCameraActive(false);
    } catch (error) {
      console.error("Error stopping camera:", error);
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return null;
    
    try {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext("2d");
      
      if (!context) return null;
      
      // Set canvas dimensions to match the video
      canvas.width = video.videoWidth || 320;
      canvas.height = video.videoHeight || 240;
      
      // Draw the current video frame to the canvas
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      return canvas.toDataURL("image/jpeg", 0.85); // Slightly improved quality
    } catch (error) {
      console.error("Error capturing photo:", error);
      return null;
    }
  };

  const handleAttendance = (type: "check-in" | "check-out") => {
    if (!currentUser || !currentLocation) {
      toast.error("User information or location not available");
      return;
    }

    // Take photo if camera is active
    let photoUrl;
    if (isCameraActive) {
      photoUrl = capturePhoto();
      if (!photoUrl) {
        toast.warning("Could not capture photo, but proceeding with attendance");
      }
    } else {
      toast.warning("No photo will be taken as camera is not active");
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

    // Close the camera sheet if open
    setIsSheetOpen(false);
    stopCamera();

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
    stopCamera();
    localStorage.removeItem("currentUser");
    navigate("/");
  };

  const viewHistory = () => {
    stopCamera();
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

        <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
          <SheetTrigger asChild>
            <Button 
              className="w-full mb-4"
              onClick={() => setIsSheetOpen(true)}
            >
              <Camera className="mr-2 h-4 w-4" /> Open Camera
            </Button>
          </SheetTrigger>
          <SheetContent className="p-0 sm:max-w-md w-full">
            <div className="p-4 space-y-4">
              <h2 className="text-lg font-bold">Camera</h2>
              
              <div className="relative aspect-video bg-black mb-2 rounded overflow-hidden">
                {isCameraActive ? (
                  <video 
                    ref={videoRef} 
                    autoPlay 
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-white p-4 text-center">
                    <Camera className="h-10 w-10 mb-2" />
                    {cameraError ? (
                      <p className="text-red-400 text-sm">{cameraError}</p>
                    ) : (
                      <p>Press the button below to start your camera</p>
                    )}
                  </div>
                )}
                <canvas ref={canvasRef} className="hidden" />
              </div>
              
              {!isCameraActive ? (
                <Button 
                  onClick={startCamera} 
                  className="w-full"
                >
                  Start Camera
                </Button>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <Button 
                    variant="outline"
                    onClick={stopCamera}
                  >
                    Stop Camera
                  </Button>
                  
                  <Button
                    onClick={() => handleAttendance(hasCheckedIn ? "check-out" : "check-in")}
                    disabled={isLoading}
                  >
                    <Clock className="mr-2 h-4 w-4" />
                    {hasCheckedIn ? "Check Out" : "Check In"}
                  </Button>
                </div>
              )}
              
              {cameraError && (
                <Alert className="bg-red-50 mt-4">
                  <AlertDescription className="text-sm">
                    <p className="font-medium">Troubleshooting tips:</p>
                    <ul className="list-disc pl-5 mt-2 space-y-1">
                      <li>Make sure you've granted camera permissions</li>
                      <li>Try using a different browser</li>
                      <li>Check if another app is using your camera</li>
                      <li>Reload the page and try again</li>
                    </ul>
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </SheetContent>
        </Sheet>

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
