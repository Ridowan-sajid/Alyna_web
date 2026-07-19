import { FaWhatsapp } from "react-icons/fa";
import "./WhatsAppButton.css";

const WHATSAPP_PHONE_NUMBER = "8801883352526";
const WHATSAPP_MESSAGE = "Hello%20I%20would%20like%20to%20know%20more";
const WHATSAPP_URL = `https://wa.me/${WHATSAPP_PHONE_NUMBER}?text=${WHATSAPP_MESSAGE}`;

function WhatsAppButton() {
  return (
    <a
      href={WHATSAPP_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Contact us on WhatsApp"
      className="whatsapp-button"
      title="Chat on WhatsApp"
    >
      <FaWhatsapp aria-hidden="true" />
    </a>
  );
}

export default WhatsAppButton;
