import React, { useState, useEffect } from "react";
import "./RoomDetails.css";
import { LuChefHat } from "react-icons/lu";
import HomeContactHeader from "./HomeContactHeader";
import { FaPhone } from "react-icons/fa6";
import RoomCalendar from "./RoomCalendar";
import { supabase } from "../lib/supabaseClient";
import { getRoomKeyFromAcc } from "../lib/roomKey";
import { useNavigate, useParams } from "react-router-dom";
import OptimizedImage from "./OptimizedImage";
import BookingCard from "./BookingCard";
import {
  buildBookingDraft,
  buildRoomSnapshot,
  saveBookingDraft,
} from "../lib/bookingFlow";

const RoomDetails = () => {
  const { slug } = useParams();
  const navigate = useNavigate();

  const [acc, setAcc] = useState(null);
  const [page, setPage] = useState(null);
  const [mainImage, setMainImage] = useState(null);
  const roomPrice = acc?.price ?? page?.content?.price ?? 2000;

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        console.debug("RoomDetails: loading accommodation for slug=", slug);
        const { data: row, error } = await supabase
          .from("accommodations")
          .select("*")
          .eq("slug", slug)
          .maybeSingle();
        if (error) {
          console.error("RoomDetails: supabase error", error);
          throw error;
        }
        if (!mounted) return;

        console.debug("RoomDetails: accommodation row=", row);

        const accl = row || {};

        // resolve storage paths to public URLs (like PopularAccommodations does)
        const rawImages = (accl && accl.images) || [];
        const images = await Promise.all(
          (rawImages || []).map(async (img) => {
            if (!img) return img;
            if (img.startsWith("http")) return img;
            try {
              const { data: urlData } = supabase.storage
                .from("images")
                .getPublicUrl(img);
              return (
                (urlData && (urlData.publicUrl || urlData.public_url)) || img
              );
            } catch {
              return img;
            }
          }),
        );

        const accWithUrls = { ...accl, images };
        setAcc(accWithUrls);

        setMainImage(
          images[0] ||
            "https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=600&q=80",
        );
        // ensure room calendar uses stable key
        // nothing to set here; RoomCalendar reads roomId prop from caller

        // try to load related page content if slug exists
        const pageSlug = accl.slug
          ? `${accl.slug}-detail`
          : `${accl.id}-detail`;
        try {
          const { data: prow, error: perr } = await supabase
            .from("pages")
            .select("*")
            .eq("slug", pageSlug)
            .maybeSingle();
          if (!perr) setPage(prow || {});
        } catch (_e) {
          console.error("Failed to load page content", _e);
        }
      } catch (_e) {
        console.error("Failed to load accommodation", _e);
      }
    };

    load();

    return () => {
      mounted = false;
    };
  }, [slug]);

  return (
    <div className="room-page">
      <HomeContactHeader title={acc?.title || "The Serene Suite"} />

      <div className="container main-content">
        <div className="room-grid">
          {/* Left Column */}
          <div className="room-info scroll-animate">
            <div className="main-image-container">
              <OptimizedImage
                src={mainImage}
                alt={acc?.title || "Superior Room"}
                className="main-room-img"
              />

              <div className="thumbnails">
                {((acc && acc.images) || []).map((img, index) => (
                  <OptimizedImage
                    key={index}
                    src={img}
                    alt={`thumb-${index}`}
                    onClick={() => setMainImage(img)}
                    className={mainImage === img ? "selected-thumb" : ""}
                  />
                ))}
              </div>
            </div>

            <div className="room-text">
              <p>
                {(page && page.content && page.content.description) ||
                  acc?.description ||
                  "Attractively ornamented with complete marble & tiles and luxurious fabrics."}
              </p>
            </div>
          </div>

          {/* Right Column */}
          <div className="room-sidebar scroll-animate">
            <div className="booking-wrapper">
              <BookingCard
                price={roomPrice}
                onBookNow={() => {
                  if (!acc?.id) return;
                  const roomSnapshot = buildRoomSnapshot({
                    ...acc,
                    image: mainImage || acc?.images?.[0],
                  });
                  saveBookingDraft(buildBookingDraft(roomSnapshot, {}));
                  navigate("/book", {
                    state: {
                      room: roomSnapshot,
                      source: "room-details",
                    },
                  });
                }}
              />
            </div>
            <div className="complimentary-section">
              <div className="complimentary-header">
                <LuChefHat size="24px" />
                {/* <img src={phoneIcon} alt="phone icon" className="icon-img" /> */}
                <span>
                  {acc?.complimentary && acc.complimentary.length
                    ? "COMPLIMENTARY"
                    : "COMPLIMENTARY"}
                </span>
              </div>

              <ul>
                {(
                  (page && page.content && page.content.complimentary) ||
                  (acc && acc.complimentary) || [
                    "Breakfast for 4 pax",
                    "Welcome drink (on arrival)",
                    "Bus-stop pick-up (on demand)",
                    "Mineral water 500ml x 2 bottles",
                    "Internet in the rooms & lobby",
                  ]
                ).map((it, i) => (
                  <li key={i}>{it}</li>
                ))}
              </ul>
            </div>

            <h5 className="check">
              {(page && page.content && page.content.availability_heading) ||
                acc?.availability_heading ||
                "CHECK AVAILABILITY"}
            </h5>

            <div className="availability-card">
              <RoomCalendar
                roomId={
                  buildRoomSnapshot({
                    ...acc,
                    image: mainImage || acc?.images?.[0],
                  }).inventoryKey ||
                  getRoomKeyFromAcc(acc) ||
                  slug
                }
              />
            </div>

            <button
              type="button"
              className="book-now-btn mobile-btn"
              onClick={() => {
                if (!acc?.id) return;
                const roomSnapshot = buildRoomSnapshot({
                  ...acc,
                  image: mainImage || acc?.images?.[0],
                });
                saveBookingDraft(buildBookingDraft(roomSnapshot, {}));
                navigate("/book", {
                  state: {
                    room: roomSnapshot,
                    source: "room-details",
                  },
                });
              }}
            >
              BOOK NOW
            </button>

            <div
              className="booking-card-container scroll-animate"
              style={{ display: "none" }}
            >
              <div className="outer-glow-border"></div>

              <div className="main-booking-box">
                <div className="content-left">
                  <div className="phone-icon-box">
                    <FaPhone fontSize={"40px"} color="#f27c07" />
                  </div>

                  <div className="cta-and-number">
                    <p className="cta-text">CALL TO CONFIRM BOOKING !</p>

                    <div className="floating-number-box">
                      <span className="phone-number">01883352526</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RoomDetails;
