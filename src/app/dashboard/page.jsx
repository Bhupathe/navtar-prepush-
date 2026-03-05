"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { auth, db } from "@/lib/firebase";
import { signOut } from "firebase/auth";
import { collection, addDoc, getDocs, query } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Monitor, Video, LogOut, Clock, User, Plus, Calendar as CalendarIcon, CheckCircle2 } from "lucide-react";
import { format, isSameDay, parseISO, isBefore, addDays } from "date-fns";
import clsx from "clsx";

// HTTP API_URL removed to use Firestore directly

export default function DashboardPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [date, setDate] = useState(new Date());
  
  const [bookings, setBookings] = useState([]);
  const [isBookingDialogOpen, setIsBookingDialogOpen] = useState(false);
  const [startHour, setStartHour] = useState("09");
  const [startMinute, setStartMinute] = useState("00");
  const [endHour, setEndHour] = useState("09");
  const [endMinute, setEndMinute] = useState("30");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const now = new Date();
  const maxDate = addDays(now, 7);

  // Fetch bookings
  const fetchBookings = async () => {
    try {
      const q = query(collection(db, "bookings"));
      const querySnapshot = await getDocs(q);
      const data = querySnapshot.docs.map(doc => ({
        id: doc.id,
        booking_id: doc.id, // Keep a reference for backward compatibility with existing code
        ...doc.data()
      }));
      setBookings(data);
    } catch (err) {
      console.error("Error fetching bookings from Firestore:", err);
    }
  };

  useEffect(() => {
    fetchBookings();
    
    // Polling everyday or manually refething would be better for real-time join button, 
    // but interval forces re-renders to check "Join" timing.
    const interval = setInterval(() => {
       // Just force a rerender every minute so the "Join" button appears exactly at -10 mins
       setBookings(b => [...b]); 
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  const handleLogout = async () => {
     try {
       await signOut(auth);
       router.push("/");
     } catch (err) {
       console.error("Logout failed", err);
       router.push("/");
     }
  };

  const joinCall = (bookingId) => {
    router.push(`/call?booking=${bookingId}`);
  };

  const handleCreateBooking = async (e) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");
    setIsSubmitting(true);

    if (!startHour || !startMinute || !endHour || !endMinute || !date || !user) {
      setErrorMsg("Please select start and end times and ensure you are logged in.");
      setIsSubmitting(false);
      return;
    }

    const startTime = `${startHour}:${startMinute}`;
    const endTime = `${endHour}:${endMinute}`;

    if (startTime >= endTime) {
      setErrorMsg("End time must be after the start time.");
      setIsSubmitting(false);
      return;
    }

    const payload = {
      date: format(date, 'yyyy-MM-dd'),
      start_time: `${startTime}:00`,
      end_time: `${endTime}:00`,
      doctor_id: 5,
      navatar_id: 1,
      location: "Ward",
      status: "Booked",
      // Store user details to identify whose booking it is
      patientName: `Session for ${user.email.split('@')[0]}`,
      room: `ROOM-${Math.floor(Math.random() * 1000)}` 
    };

    try {
      await addDoc(collection(db, "bookings"), payload);

      setSuccessMsg("Booking created successfully!");
      fetchBookings();
      setTimeout(() => {
        setIsBookingDialogOpen(false);
        setSuccessMsg("");
        setStartHour("09");
        setStartMinute("00");
        setEndHour("09");
        setEndMinute("30");
      }, 1500);

    } catch (err) {
      console.error("Firestore Add Error:", err);
      setErrorMsg("Failed to create booking. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Derived constraints for time selectors based on 'date'
  const isToday = date && isSameDay(date, now);
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();

  const getAvailableHours = (forEnd = false) => {
    const hours = [];
    const minHour = (isToday && !forEnd) ? currentHour : 0;
    const startH = forEnd ? parseInt(startHour, 10) : minHour;
    
    for (let i = startH; i < 24; i++) {
      hours.push(i.toString().padStart(2, '0'));
    }
    return hours;
  };

  const getAvailableMinutes = (hourStr, isEnd = false) => {
    const mins = [];
    const h = parseInt(hourStr, 10);
    
    let minMinute = 0;
    if (isToday && !isEnd && h === currentHour) {
      minMinute = currentMinute;
    } else if (isEnd && h === parseInt(startHour, 10)) {
      minMinute = parseInt(startMinute, 10) + 5; // End time must be at least 5 mins after start
    }

    for (let i = 0; i < 60; i += 5) {
      if (i >= minMinute) {
        mins.push(i.toString().padStart(2, '0'));
      }
    }
    return mins;
  };

  // Handle auto-correction when date or start time changes
  useEffect(() => {
    if (isToday) {
      if (parseInt(startHour, 10) < currentHour) setStartHour(currentHour.toString().padStart(2, '0'));
      if (parseInt(startHour, 10) === currentHour && parseInt(startMinute, 10) < currentMinute) {
         const nextValidMin = Math.ceil(currentMinute / 5) * 5;
         setStartMinute(nextValidMin < 60 ? nextValidMin.toString().padStart(2, '0') : "55");
      }
    }
  }, [date, isToday, currentHour, currentMinute, startHour, startMinute]);

  useEffect(() => {
    if (parseInt(endHour, 10) < parseInt(startHour, 10)) {
      setEndHour(startHour);
    }
    if (endHour === startHour && parseInt(endMinute, 10) <= parseInt(startMinute, 10)) {
      const nextMin = parseInt(startMinute, 10) + 15; // default 15 min duration
      if (nextMin < 60) setEndMinute(nextMin.toString().padStart(2, '0'));
      else {
        const nextHour = parseInt(startHour, 10) + 1;
        if (nextHour < 24) {
          setEndHour(nextHour.toString().padStart(2, '0'));
          setEndMinute("00");
        }
      }
    }
  }, [startHour, startMinute, endHour, endMinute]);
  const filteredBookings = useMemo(() => {
    return bookings.filter(booking => {
       if (!booking.date || !date) return false;
       return isSameDay(parseISO(booking.date), date);
    }).sort((a, b) => a.start_time.localeCompare(b.start_time));
  }, [bookings, date]);

  if (loading) return null;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
       {/* Top Navigation */}
       <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 z-10 shadow-sm">
          <div className="flex items-center gap-2 text-blue-700">
             <Monitor className="h-6 w-6" />
             <span className="font-bold text-xl tracking-tight">Navatar Dashboard</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-sm font-medium text-slate-600 hidden md:flex items-center gap-2">
              <User className="h-4 w-4" /> {user?.email || "Doctor Account"}
            </div>
            <Button variant="ghost" size="sm" onClick={handleLogout} className="text-slate-500 hover:text-red-600">
               <LogOut className="h-4 w-4 mr-2" /> Logout
            </Button>
          </div>
       </header>

       {/* Main Content */}
       <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Calendar Section (Left) */}
          <div className="lg:col-span-4 space-y-6">
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="bg-slate-50/50 pb-4 border-b border-slate-100">
                <CardTitle className="text-slate-800">Schedule</CardTitle>
                <CardDescription>Select a date up to 7 days in advance</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={setDate}
                  fromDate={now}
                  toDate={maxDate}
                  className="p-3 w-full flex justify-center rounded-b-xl"
                  classNames={{
                    day_selected: "bg-blue-600 text-white hover:bg-blue-600 hover:text-white focus:bg-blue-600 focus:text-white",
                    day_today: "bg-slate-100 text-slate-900 font-bold",
                  }}
                />
              </CardContent>
              <CardFooter className="pt-4 border-t border-slate-100 block">
                 <Button className="w-full bg-blue-600 hover:bg-blue-700" onClick={() => setIsBookingDialogOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" /> Schedule New Session
                 </Button>
              </CardFooter>
            </Card>
          </div>

          {/* Bookings List Section (Right) */}
          <div className="lg:col-span-8">
            <Card className="h-full border-slate-200 shadow-sm flex flex-col">
              <CardHeader className="bg-white pb-4 border-b border-slate-100">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                   <div>
                     <CardTitle className="text-slate-800 text-2xl font-bold">Appointments</CardTitle>
                     <CardDescription className="text-slate-500 mt-1 flex items-center gap-1">
                       <CalendarIcon className="h-4 w-4" />
                       {date ? format(date, "EEEE, MMMM do, yyyy") : "Select a date"}
                     </CardDescription>
                   </div>
                   <div className="bg-blue-50 text-blue-700 border border-blue-100 font-bold px-3 py-1.5 rounded-full text-sm self-start sm:self-auto">
                      {filteredBookings.length} {filteredBookings.length === 1 ? 'Session' : 'Sessions'}
                   </div>
                </div>
              </CardHeader>
              <CardContent className="flex-1 p-0">
                <ScrollArea className="h-[calc(100vh-280px)] rounded-b-xl">
                  {filteredBookings.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-12 text-slate-400 h-full min-h-[400px]">
                      <Clock className="h-12 w-12 mb-4 opacity-20" />
                      <p className="font-medium text-lg">No appointments scheduled</p>
                      <p className="text-sm mt-1">Click &quot;Schedule New Session&quot; to book a time.</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {filteredBookings.map((booking) => {
                        // Calculate timing logic
                        const current = new Date();
                        const [sH, sM] = booking.start_time.split(':').map(Number);
                        const [eH, eM] = booking.end_time.split(':').map(Number);
                        
                        const slotStart = new Date(booking.date);
                        slotStart.setHours(sH, sM, 0, 0);

                        const slotEnd = new Date(booking.date);
                        slotEnd.setHours(eH, eM, 0, 0);

                        // Is within 10 minutes of start, up until the end of the meeting
                        // Bypassed for testing: make all non-completed sessions joinable immediately
                        const isCompleted = current > slotEnd;
                        const isJoinable = !isCompleted;

                        return (
                        <div key={booking.booking_id || booking.id} className={clsx(
                           "p-6 flex flex-col sm:flex-row gap-4 sm:items-center justify-between transition-colors hover:bg-slate-50",
                           isJoinable ? "bg-blue-50/50" : ""
                        )}>
                          <div className="flex items-start gap-4">
                             <div className="min-w-[100px] text-center pt-1">
                               <p className="text-lg font-bold text-slate-800">{booking.start_time.slice(0, 5)}</p>
                               <p className="text-xs text-slate-500">to {booking.end_time.slice(0, 5)}</p>
                             </div>
                             <Separator orientation="vertical" className="h-12 hidden sm:block bg-slate-200" />
                             <div>
                               <h3 className="text-lg font-semibold text-slate-900">{booking.patientName || "Remote Session"}</h3>
                               <p className="text-sm text-slate-500 mt-1 flex items-center gap-2">
                                 <span className={clsx(
                                   "inline-block w-2 h-2 rounded-full",
                                   isCompleted ? "bg-slate-300" : isJoinable ? "bg-green-500 animate-pulse" : "bg-blue-400"
                                 )} />
                                 {isCompleted ? "Completed" : isJoinable ? "Active Now" : "Scheduled"}
                               </p>
                             </div>
                          </div>
                          <div className="sm:pl-4 mt-2 sm:mt-0 flex flex-col gap-2 w-full sm:w-auto">
                            {!isCompleted && (
                               <Button 
                                 onClick={() => joinCall(booking.booking_id || booking.id)}
                                 disabled={!isJoinable}
                                 className={clsx(
                                   "w-full sm:w-auto transition-all",
                                   isJoinable
                                      ? "bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-200" 
                                      : "bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed"
                                 )}
                                 variant={isJoinable ? "default" : "outline"}
                               >
                                 <Video className="h-4 w-4 mr-2" />
                                 Join Call
                               </Button>
                            )}
                            {!isJoinable && !isCompleted && (
                              <span className="text-xs text-slate-400 text-center">Opens 10m early</span>
                            )}
                          </div>
                        </div>
                      )})}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
       </main>

       {/* Booking Form Dialog */}
       <Dialog open={isBookingDialogOpen} onOpenChange={setIsBookingDialogOpen}>
         <DialogContent className="sm:max-w-[425px]">
           <DialogHeader>
             <DialogTitle>Schedule Navatar Session</DialogTitle>
             <DialogDescription>
               Book a time to connect to the telepresence robot on {date && format(date, "MMMM do, yyyy")}.
             </DialogDescription>
           </DialogHeader>
           <form onSubmit={handleCreateBooking} className="space-y-4 py-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <Label className="text-slate-600 font-bold">Start Time</Label>
                  <div className="flex items-center gap-2">
                    <select 
                      className="flex h-10 w-full items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2"
                      value={startHour}
                      onChange={(e) => setStartHour(e.target.value)}
                    >
                      {getAvailableHours().map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                    <span className="text-slate-400 font-bold">:</span>
                    <select 
                      className="flex h-10 w-full items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2"
                      value={startMinute}
                      onChange={(e) => setStartMinute(e.target.value)}
                    >
                      {getAvailableMinutes(startHour).map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                </div>

                <div className="space-y-3">
                  <Label className="text-slate-600 font-bold">End Time</Label>
                  <div className="flex items-center gap-2">
                    <select 
                      className="flex h-10 w-full items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2"
                      value={endHour}
                      onChange={(e) => setEndHour(e.target.value)}
                    >
                      {getAvailableHours(true).map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                    <span className="text-slate-400 font-bold">:</span>
                    <select 
                      className="flex h-10 w-full items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2"
                      value={endMinute}
                      onChange={(e) => setEndMinute(e.target.value)}
                    >
                      {getAvailableMinutes(endHour, true).map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              {errorMsg && <p className="text-sm text-red-500 font-medium bg-red-50 p-2 rounded-md border border-red-100">{errorMsg}</p>}
              
              {successMsg && (
                 <div className="p-3 bg-green-50 border border-green-200 rounded-md flex items-center gap-2 text-green-700 font-medium text-sm">
                   <CheckCircle2 className="h-4 w-4" /> {successMsg}
                 </div>
              )}

              <DialogFooter className="pt-4">
                <Button type="button" variant="outline" onClick={() => setIsBookingDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting} className="bg-blue-600 hover:bg-blue-700 text-white">
                  {isSubmitting ? "Saving..." : "Confirm Booking"}
                </Button>
              </DialogFooter>
           </form>
         </DialogContent>
       </Dialog>
    </div>
  );
}
