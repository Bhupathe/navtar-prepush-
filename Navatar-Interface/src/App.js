import { useEffect, useRef, useState } from "react";
import ConferencePage from "./components/ConferencePage";
import { getDoctor } from "./context/doctorAPI";
import dayjs from "dayjs";
import { CircleUser } from "lucide-react";
import { SocketProvider } from "./context/SocketProvider";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "./context/firebase";

const Navatar = {
  navatarId: 1,
  name: "Navatar01",
  hospital_id: 13,
  isVideoOn: true,
  isAudioOn: true,
};

export default function App() {
  const [upcomingBooking, setUpcomingBooking] = useState(null);
  const [doctorName, setDoctorName] = useState("");
  const [joined, setJoined] = useState(false);
  const timeoutRef = useRef(null);

  const [allBookings, setAllBookings] = useState([]);

  // 1. Subscribe to Firestore in Real-Time (Only consumes reads when bookings change)
  useEffect(() => {
    const q = query(
      collection(db, "bookings"),
      where("navatar_id", "==", Navatar.navatarId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        booking_id: doc.id,
        ...doc.data()
      }));
      setAllBookings(data);
    }, (error) => {
      console.error("Firestore Listen Error:", error);
    });

    return () => unsubscribe();
  }, []);

  // 2. Local Polling for the Time to Auto-Join
  useEffect(() => {
    const checkSchedule = () => {
      if (allBookings.length === 0) return;

      const now = dayjs();
      
      // Find current active booking
      const currentBooking = allBookings.find((b) => {
        const start = dayjs(`${b.date} ${b.start_time}`);
        const end = dayjs(`${b.date} ${b.end_time}`);

        if (!start.isValid() || !end.isValid()) return false;

        // Is within 30 mins before, and hasn't ended
        return start.subtract(30, "minute").isBefore(now) && end.isAfter(now);
      });

      if (
        !upcomingBooking ||
        !currentBooking ||
        upcomingBooking.booking_id !== currentBooking.booking_id
      ) {
        setUpcomingBooking(currentBooking || null);
      }

      if (!currentBooking) return;

      const start = dayjs(`${currentBooking.date} ${currentBooking.start_time}`);
      const diffToStart = start.diff(now, "minute", true);

      // Auto-join if start time has arrived / passed
      if (diffToStart <= 0 && !joined) {
        setJoined(true);
      }
    };

    // Execute immediately and then poll every 15s (Locally on memory, 0 Firestore cost)
    checkSchedule();
    const interval = setInterval(checkSchedule, 15000);

    return () => {
      clearInterval(interval);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [allBookings, joined, upcomingBooking]);

  useEffect(() => {
    const fetchDoctorName = async () => {
      if (upcomingBooking?.doctor_id) {
        try {
          const res = await getDoctor(upcomingBooking.doctor_id);
          setDoctorName(res.data.name);
        } catch (err) {
          console.error("Error fetching doctor name", err);
          setDoctorName("Unknown Doctor");
        }
      }
    };

    fetchDoctorName();
  }, [upcomingBooking]);

  const handleJoin = () => {
    setJoined(true);
  };

  const handleLeave = () => {
    setJoined(false);
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

  if (joined && upcomingBooking) {
    const user = {
      name: Navatar.name,
      email: `${Navatar.name}@conference.com`,
      isVideoOn: Navatar.isVideoOn,
      isAudioOn: Navatar.isAudioOn,
    };
    return (
      <SocketProvider>
        <ConferencePage
          user={user}
          room={String(upcomingBooking.doctor_id)}
          onLeave={handleLeave}
        />
      </SocketProvider>
    );
  }

  return (
    <div className="navatar-interface">
      {upcomingBooking ? (
        <>
          <h1 className="title">{Navatar.name}</h1>
          <div className="avatar">
            <CircleUser size={500} />
          </div>
          <div className="session">
            <span>
              <h3> {doctorName || "Loading..."}</h3>
            </span>
            <p>
              {dayjs(
                `${upcomingBooking.date} ${upcomingBooking.start_time}`
              ).format("HH:mm")}{" "}
              -{" "}
              {dayjs(
                `${upcomingBooking.date} ${upcomingBooking.end_time}`
              ).format("HH:mm")}
            </p>

            {dayjs(
              `${upcomingBooking.date} ${upcomingBooking.start_time}`
            ).diff(dayjs(), "minute") <= 10 && (
              <button className="join-btn" onClick={handleJoin}>
                Join Call
              </button>
            )}
          </div>
        </>
      ) : (
        <h1>No upcoming session.</h1>
      )}
    </div>
  );
}
