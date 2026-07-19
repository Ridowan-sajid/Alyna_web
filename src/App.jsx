import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import Header from "./components/Header";
import Footer from "./components/Footer";
import Home from "./Home";
import AboutPage from "./components/AboutPage";
import "./App.css";
import "./styles/scroll-animate.css";
import ScrollReveal from "./components/ScrollReveal";
import ScrollToTop from "./components/ScrollToTop";
import MapContactSection from "./components/MapContactSection";
import Gallery from "./components/Gallery";
import RoomDetails from "./components/RoomDetails";
import Admin from "./components/Admin";
import { CalendarProvider } from "./context/CalendarContext";
import { Analytics } from "@vercel/analytics/react";

import { supabase } from "./lib/supabaseClient";
import { useEffect } from "react";
import BookingForm from "./components/BookingForm";
import PaymentForm from "./components/PaymentForm";
import ReservationConfirmed from "./components/ReservationConfirmed";
import OfferPopup from "./components/OfferPopup";
import WhatsAppButton from "./components/WhatsAppButton";

function App() {
  useEffect(() => {
    const testSupabase = async () => {
      const { data, error } = await supabase.auth.getSession();

      console.log("Supabase session:", data);
      console.log("Supabase error:", error);
    };

    testSupabase();
  }, []);

  return (
    <Router>
      <CalendarProvider>
        <div className="app">
          <ScrollToTop />
          <ScrollReveal />
          <Header />
          <OfferPopup />
          <main>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/about" element={<AboutPage />} />
              <Route path="/contact" element={<MapContactSection />} />
              <Route path="/gallery" element={<Gallery />} />
              <Route path="/rooms/:slug" element={<RoomDetails />} />
              {/* legacy single-room paths redirect to rooms listing */}
              <Route path="/room" element={<Navigate to="/" replace />} />
              <Route path="/room2" element={<Navigate to="/" replace />} />
              <Route path="/admin" element={<Admin />} />
              <Route path="/book" element={<BookingForm />} />
              <Route path="/payment" element={<PaymentForm />} />
              <Route path="/reservation" element={<ReservationConfirmed />} />
            </Routes>
          </main>
          <Footer />
          <WhatsAppButton />
          <Analytics />
        </div>
      </CalendarProvider>
    </Router>
  );
}

export default App;
