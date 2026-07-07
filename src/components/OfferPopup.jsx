import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import "./OfferPopup.css";

const STORAGE_KEY = "offerSeen";
const POPUP_INTERVAL_MS = 24 * 60 * 60 * 1000;
const POPUP_DELAY_MS = 10000;

export default function OfferPopup() {
  const [isOpen, setIsOpen] = useState(false);
  const [showPopup, setShowPopup] = useState(false); // new
  const [showSticky, setShowSticky] = useState(false);
  const [imageUrl, setImageUrl] = useState("");
  const [bannerImageUrl, setBannerImageUrl] = useState("");

  useEffect(() => {
    let mounted = true;
    let timer;

    const loadOfferImage = async () => {
      try {
        const { data, error } = await supabase
          .from("pages")
          .select("content, hero_image")
          .eq("slug", "home")
          .maybeSingle();

        if (error) throw error;

        const offerImage =
          data?.content?.offer_image || data?.content?.offerImage || "";

        const bannerImage =
          data?.content?.banner_image ||
          data?.content?.sticky_banner_image ||
          data?.content?.bannerImage ||
          data?.content?.stickyBannerImage ||
          "";

        if (!mounted) return;

        const storedValue = window.localStorage.getItem(STORAGE_KEY);
        const shouldShow =
          !storedValue || Date.now() - Number(storedValue) >= POPUP_INTERVAL_MS;

        setImageUrl(offerImage);
        setBannerImageUrl(bannerImage);

        if (shouldShow) {
          timer = setTimeout(() => {
            if (mounted) {
              setIsOpen(true);

              // show popup + backdrop together after image is ready
              setTimeout(() => {
                setShowPopup(true);
              }, 100);
            }
          }, POPUP_DELAY_MS);
        }
      } catch (err) {
        console.error("Failed to load offer popup image:", err);
      }
    };

    loadOfferImage();

    return () => {
      mounted = false;
      clearTimeout(timer);
    };
  }, []);

  const closePopup = () => {
    window.localStorage.setItem(STORAGE_KEY, String(Date.now()));
    setShowPopup(false);
    setIsOpen(false);
    setShowSticky(true);
  };

  const closeSticky = () => {
    setShowSticky(false);
  };

  return (
    <>
      {isOpen && showPopup && (
        <div className="offer-popup-backdrop" role="dialog" aria-modal="true">
          <div className="offer-popup-card">
            <button
              className="offer-popup-close"
              onClick={closePopup}
              aria-label="Close offer popup"
            >
              ×
            </button>

            {imageUrl ? (
              <img
                className="offer-popup-image"
                src={imageUrl}
                alt="Special offer"
              />
            ) : (
              <div className="offer-popup-placeholder">
                <h3>Special Offer</h3>
                <p>Upload an offer image from admin.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {showSticky && bannerImageUrl && (
        <div className="offer-sticky-banner">
          <img src={bannerImageUrl} alt="Offer banner" />
          <button onClick={closeSticky}>×</button>
        </div>
      )}
    </>
  );
}
