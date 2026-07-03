import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import "./OfferPopup.css";

const STORAGE_KEY = "offerSeen";
const POPUP_INTERVAL_MS = 24 * 60 * 60 * 1000;

export default function OfferPopup() {
  const [isOpen, setIsOpen] = useState(false);
  const [imageUrl, setImageUrl] = useState("");

  useEffect(() => {
    let mounted = true;

    const loadOfferImage = async () => {
      try {
        const { data, error } = await supabase
          .from("pages")
          .select("content, hero_image")
          .eq("slug", "home")
          .maybeSingle();

        if (error) throw error;

        const offerImage =
          data?.content?.offer_image ||
          data?.content?.offerImage ||
          data?.hero_image ||
          "";

        if (!mounted) return;

        const storedValue = window.localStorage.getItem(STORAGE_KEY);
        const shouldShow =
          !storedValue || Date.now() - Number(storedValue) >= POPUP_INTERVAL_MS;

        setImageUrl(offerImage);
        setIsOpen(shouldShow);
      } catch (err) {
        console.error("Failed to load offer popup image:", err);
        if (mounted) setIsOpen(false);
      }
    };

    loadOfferImage();

    return () => {
      mounted = false;
    };
  }, []);

  const closePopup = () => {
    window.localStorage.setItem(STORAGE_KEY, String(Date.now()));
    setIsOpen(false);
  };

  if (!isOpen) return null;

  return (
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
            <p>Upload an offer image from the admin section to show it here.</p>
          </div>
        )}
      </div>
    </div>
  );
}
