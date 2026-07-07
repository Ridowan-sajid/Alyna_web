import React, { useEffect, useState } from "react";
import "./Admin.css";
import { supabase } from "../lib/supabaseClient";
import { getRoomKeyFromAcc, getRoomKeyFromIdOrSlug } from "../lib/roomKey";
import SupabaseImageUploader from "./SupabaseImageUploader";
import seedData from "../data/seedData";

function slugify(text) {
  if (!text) return null;
  return String(text)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default function AdminEditor({ view }) {
  const [data, setData] = useState(null);
  const [tagInputMain, setTagInputMain] = useState("");
  const [accomTagInputs, setAccomTagInputs] = useState({});
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [roomCalendar, setRoomCalendar] = useState({
    booked: [],
    almost: [],
    free: [],
  });
  const [roomSelectedDate, setRoomSelectedDate] = useState("");
  const [roomKey, setRoomKey] = useState(null);

  const isRoomView = (v) => {
    return (
      typeof v === "string" && (v.startsWith("room-") || v.startsWith("accom-"))
    );
  };

  useEffect(() => {
    setError("");
    setStatus("");
    loadData(view);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, roomKey]);

  // sync tag input states when data changes
  useEffect(() => {
    if (!data) {
      setTagInputMain("");
      setAccomTagInputs({});
      return;
    }
    setTagInputMain((data.tags || []).join(", "));
    const map = {};
    (data.accommodations || []).forEach((acc, i) => {
      map[i] = (acc.tags || []).join(", ");
    });
    setAccomTagInputs(map);
  }, [data]);

  const parseTagsFromString = (s) =>
    (s || "")
      .split(/[,\s]+/)
      .map((t) => t.trim())
      .filter(Boolean);

  const normalizePrice = (value) => {
    if (value === "" || value === null || value === undefined) return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  };

  async function loadData(viewKey) {
    setLoading(true);
    try {
      if (viewKey === "home" || viewKey === "about") {
        const { data: row, error } = await supabase
          .from("pages")
          .select("*")
          .eq("slug", viewKey)
          .maybeSingle();
        if (error) throw error;
        if (row) {
          // also load related collections for home editor
          if (viewKey === "home") {
            const { data: accommodations } = await supabase
              .from("accommodations")
              .select("*")
              .order("id", { ascending: true });
            const { data: features } = await supabase
              .from("features")
              .select("*")
              .order("id", { ascending: true });
            const { data: testimonials } = await supabase
              .from("testimonials")
              .select("*")
              .order("id", { ascending: true });
            const { data: facilities } = await supabase
              .from("facilities")
              .select("*")
              .eq("page_id", row.id)
              .order("id", { ascending: true });
            const mappedFacilities = (facilities || []).map((f) => ({
              ...f,
              images: (f.images || []).map((img) => {
                if (!img) return img;
                if (img.startsWith("http")) return img;
                try {
                  const { data: urlData } = supabase.storage
                    .from("images")
                    .getPublicUrl(img);
                  return (
                    (urlData && (urlData.publicUrl || urlData.public_url)) ||
                    img
                  );
                } catch (e) {
                  return img;
                }
              }),
            }));
            setData({
              ...(row || {}),
              accommodations: accommodations || [],
              features: features || [],
              testimonials: testimonials || [],
              facilities: mappedFacilities,
            });
          } else setData(row);
        } else {
          // try to seed from local seedData if available
          const seed = seedData[viewKey];
          if (seed) {
            const { error: insErr } = await supabase.from("pages").insert([
              {
                slug: viewKey,
                title: seed.title || null,
                hero_image: seed.hero_image || null,
                hero_heading: seed.hero_heading || null,
                hero_subtext: seed.hero_subtext || null,
                content: seed,
              },
            ]);
            if (insErr)
              console.warn("Seeding pages failed:", insErr.message || insErr);
            const { data: newRow } = await supabase
              .from("pages")
              .select("*")
              .eq("slug", viewKey)
              .maybeSingle();
            if (viewKey === "home") {
              const { data: accommodations } = await supabase
                .from("accommodations")
                .select("*")
                .order("id", { ascending: true });
              const { data: features } = await supabase
                .from("features")
                .select("*")
                .order("id", { ascending: true });
              const { data: testimonials } = await supabase
                .from("testimonials")
                .select("*")
                .order("id", { ascending: true });
              const { data: facilities } = await supabase
                .from("facilities")
                .select("*")
                .eq("page_id", newRow.id)
                .order("id", { ascending: true });
              const mappedFacilities2 = (facilities || []).map((f) => ({
                ...f,
                images: (f.images || []).map((img) => {
                  if (!img) return img;
                  if (img.startsWith("http")) return img;
                  try {
                    const { data: urlData } = supabase.storage
                      .from("images")
                      .getPublicUrl(img);
                    return (
                      (urlData && (urlData.publicUrl || urlData.public_url)) ||
                      img
                    );
                  } catch (e) {
                    return img;
                  }
                }),
              }));
              setData({
                ...(newRow || {}),
                accommodations: accommodations || [],
                features: features || [],
                testimonials: testimonials || [],
                facilities: mappedFacilities2,
              });
            } else setData(newRow || {});
          } else setData({});
        }
      } else if (isRoomView(viewKey)) {
        // support dynamic room-<id> or accom-<id> views
        let idToFetch = null;
        if (typeof viewKey === "string") {
          const parts = viewKey.split("-");
          const idPart = parts[1];
          if (/^\d+$/.test(idPart)) idToFetch = parseInt(idPart, 10);
        }

        let row = null;
        let error = null;
        if (idToFetch) {
          const res = await supabase
            .from("accommodations")
            .select("*")
            .eq("id", idToFetch)
            .maybeSingle();
          row = res.data;
          error = res.error;
        } else {
          row = null;
          error = null;
        }
        if (error) throw error;
        if (row) {
          try {
            const detailSlug =
              row && row.slug ? `${row.slug}-detail` : `${row.id}-detail`;
            const { data: pageRow } = await supabase
              .from("pages")
              .select("*")
              .eq("slug", detailSlug)
              .maybeSingle();
            const content = (pageRow && pageRow.content) || {};
            const merged = {
              ...row,
              description: content.description || row.description,
              images: content.images || row.images,
              complimentary: content.complimentary || row.complimentary || [],
              price: content.price ?? row.price ?? null,
              availability_heading:
                content.availability_heading ||
                row.availability_heading ||
                null,
            };
            setData(merged);
            // compute a stable room key for calendar operations: prefer slug, fall back to `room{ id }`
            const roomKeyVal = getRoomKeyFromAcc(row) || null;
            setRoomKey(roomKeyVal);
          } catch (e) {
            setData(row);
            const roomKeyVal = getRoomKeyFromAcc(row) || null;
            setRoomKey(roomKeyVal);
          }
        } else {
          setData({});
        }
      } else if (viewKey === "contact") {
        const { data: rows, error } = await supabase
          .from("contact_info")
          .select("*")
          .limit(1);
        if (error) throw error;
        if (rows && rows[0]) setData(rows[0]);
        else {
          const seed = seedData.contact;
          if (seed) {
            const { error: insErr } = await supabase
              .from("contact_info")
              .insert([seed]);
            if (insErr)
              console.warn(
                "Seeding contact_info failed:",
                insErr.message || insErr,
              );
            const { data: newRows } = await supabase
              .from("contact_info")
              .select("*")
              .limit(1);
            setData((newRows && newRows[0]) || {});
          } else setData({});
        }
      } else if (viewKey === "gallery") {
        const { data: images, error } = await supabase
          .from("gallery_images")
          .select("*")
          .order("id", { ascending: true });
        // also load gallery page row (stores video_url)
        const { data: pageRow } = await supabase
          .from("pages")
          .select("*")
          .eq("slug", "gallery")
          .maybeSingle();
        if (error) throw error;
        if (images && images.length)
          setData({
            images: images || [],
            video_url:
              (pageRow && (pageRow.video_url || pageRow.content?.video_url)) ||
              null,
          });
        else {
          const seed = seedData.gallery;
          if (seed && Array.isArray(seed.images)) {
            const toInsert = seed.images.map((i) => ({
              label: i.label,
              url: i.url,
            }));
            const { error: insErr } = await supabase
              .from("gallery_images")
              .insert(toInsert);
            if (insErr)
              console.warn(
                "Seeding gallery_images failed:",
                insErr.message || insErr,
              );
            const { data: newImages } = await supabase
              .from("gallery_images")
              .select("*")
              .order("id", { ascending: true });
            // if seed has a video_url, persist it to pages table
            const videoVal = seed.video_url || null;
            if (videoVal) {
              const { data: existingPage } = await supabase
                .from("pages")
                .select("*")
                .eq("slug", "gallery")
                .maybeSingle();
              if (existingPage) {
                await supabase
                  .from("pages")
                  .update({
                    content: {
                      ...(existingPage.content || {}),
                      video_url: videoVal,
                    },
                    updated_at: new Date().toISOString(),
                  })
                  .eq("id", existingPage.id);
              } else {
                await supabase.from("pages").insert([
                  {
                    slug: "gallery",
                    content: { video_url: videoVal },
                    updated_at: new Date().toISOString(),
                  },
                ]);
              }
            }
            setData({ images: newImages || [], video_url: videoVal });
          } else setData({ images: [] });
        }
      } else {
        setData({});
      }
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to load data");
      setData({});
    } finally {
      setLoading(false);
    }
  }

  // load calendar dates for current room view
  useEffect(() => {
    let mounted = true;
    const loadRoomCalendar = async () => {
      const roomIdVal = roomKey;
      if (!roomIdVal) return;
      try {
        const { data: rows, error } = await supabase
          .from("calendar_dates")
          .select("date,status")
          .eq("room", roomIdVal);
        if (error) throw error;
        if (!mounted) return;
        const shape = { booked: [], almost: [], free: [] };
        (rows || []).forEach((r) => {
          const s = r.status || "booked";
          const d =
            typeof r.date === "string" ? r.date : r.date && r.date.toString();
          if (shape[s]) shape[s].push(d);
        });
        setRoomCalendar(shape);
      } catch (e) {
        console.error("Failed to load room calendar", e);
      }
    };

    loadRoomCalendar();
    return () => {
      mounted = false;
    };
  }, [roomKey]);

  const upsertRoomDate = async (roomId, date, statusVal) => {
    if (!roomId || !date || !statusVal) return;
    try {
      const { error } = await supabase
        .from("calendar_dates")
        .upsert([{ room: roomId, date, status: statusVal }], {
          onConflict: ["room", "date"],
        });
      if (error) throw error;
      // refresh local
      const { data: rows } = await supabase
        .from("calendar_dates")
        .select("date,status")
        .eq("room", roomId);
      const shape = { booked: [], almost: [], free: [] };
      (rows || []).forEach((r) => {
        const s = r.status || "booked";
        const d =
          typeof r.date === "string" ? r.date : r.date && r.date.toString();
        if (shape[s]) shape[s].push(d);
      });
      setRoomCalendar(shape);
    } catch (e) {
      console.error("Failed upsert room date", e);
      throw e;
    }
  };

  const deleteRoomDate = async (roomId, date) => {
    if (!roomId || !date) return;
    try {
      const { error } = await supabase
        .from("calendar_dates")
        .delete()
        .eq("room", roomId)
        .eq("date", date);
      if (error) throw error;
      setRoomCalendar((p) => ({
        booked: (p.booked || []).filter((d) => d !== date),
        almost: (p.almost || []).filter((d) => d !== date),
        free: (p.free || []).filter((d) => d !== date),
      }));
    } catch (e) {
      console.error("Failed delete room date", e);
      throw e;
    }
  };

  const handleChange = (path, value) =>
    setData((p) => ({ ...(p || {}), [path]: value }));

  const handleListChange = (key, index, field, value) => {
    setData((prev) => {
      const list = Array.isArray(prev[key]) ? [...prev[key]] : [];
      list[index] = { ...list[index], [field]: value };
      return { ...prev, [key]: list };
    });
  };

  const handleAddList = (key, item = {}) =>
    setData((prev) => ({
      ...(prev || {}),
      [key]: [...(prev?.[key] || []), item],
    }));

  const handleRemoveList = (key, index) =>
    setData((prev) => ({
      ...prev,
      [key]: prev[key].filter((_, i) => i !== index),
    }));

  async function handleSave() {
    setStatus("");
    setError("");
    setLoading(true);
    try {
      if (view === "home" || view === "about") {
        // Ensure facilities (edited at top-level) are preserved in pages.content
        const contentObj =
          data.content && typeof data.content === "object"
            ? { ...data.content }
            : {};
        if (data.facilities) contentObj.facilities = data.facilities;

        const payload = {
          title: data.title || null,
          hero_image: data.hero_image || null,
          hero_heading: data.hero_heading || null,
          hero_subtext: data.hero_subtext || null,
          content: contentObj,
          updated_at: new Date().toISOString(),
        };

        const exists = !!data?.id;
        let pageRow = null;
        if (exists) {
          const { data: updated, error } = await supabase
            .from("pages")
            .update(payload)
            .eq("id", data.id)
            .select()
            .maybeSingle();
          if (error) throw error;
          pageRow = updated || data;
          setData(pageRow);
        } else {
          const slug = view;
          const { data: inserted, error } = await supabase
            .from("pages")
            .insert([{ slug, ...payload }])
            .select()
            .maybeSingle();
          if (error) throw error;
          pageRow = inserted || data;
          setData(pageRow);
        }

        // If home, also sync accommodations, features, testimonials, facilities
        if (view === "home") {
          // accommodations
          const incomingAccom = data.accommodations || [];
          const { data: existingAccom } = await supabase
            .from("accommodations")
            .select("id");
          const existingAccomIds = (existingAccom || []).map((r) => r.id);
          const incomingAccomIds = incomingAccom
            .map((i) => i.id)
            .filter(Boolean);
          const toDeleteAccom = existingAccomIds.filter(
            (id) => !incomingAccomIds.includes(id),
          );
          if (toDeleteAccom.length) {
            const { error } = await supabase
              .from("accommodations")
              .delete()
              .in("id", toDeleteAccom);
            if (error) throw error;
          }
          for (const item of incomingAccom) {
            const payloadA = {
              title: item.title || null,
              description: item.description || null,
              extended_title: item.extended_title || item.extendedTitle || null,
              price: normalizePrice(item.price),
              coupon_code: item.coupon_code || null,
              discount_value: normalizePrice(item.discount_value),
              tags: item.tags || null,
              images: item.images || null,
            };
            if (item.id) {
              const { error } = await supabase
                .from("accommodations")
                .update(payloadA)
                .eq("id", item.id);
              if (error) throw error;
            } else {
              const computed =
                item.slug || slugify(item.title) || `room-${Date.now()}`;
              const { error } = await supabase
                .from("accommodations")
                .insert([{ slug: computed, ...payloadA }]);
              if (error) throw error;
            }
          }

          // Sync accommodations -> pages.detail so room editor/readers prefer updated images/description
          try {
            const { data: allAcc } = await supabase
              .from("accommodations")
              .select("*");
            for (const a of allAcc || []) {
              const detailSlug = `${a.slug}-detail`;
              const contentObj = {
                description: a.description || null,
                images: a.images || null,
                price: a.price ?? null,
                coupon_code: a.coupon_code ?? null,
                discount_value: a.discount_value ?? null,
              };

              const { data: existingPage } = await supabase
                .from("pages")
                .select("*")
                .eq("slug", detailSlug)
                .maybeSingle();
              if (existingPage) {
                await supabase
                  .from("pages")
                  .update({
                    content: { ...(existingPage.content || {}), ...contentObj },
                    updated_at: new Date().toISOString(),
                  })
                  .eq("id", existingPage.id);
              } else {
                await supabase.from("pages").insert([
                  {
                    slug: detailSlug,
                    content: contentObj,
                    updated_at: new Date().toISOString(),
                  },
                ]);
              }
            }
          } catch (e) {
            console.error("Failed to sync accommodations to pages:", e);
          }

          // features
          const incomingFeatures = data.features || [];
          const { data: existingFeatures } = await supabase
            .from("features")
            .select("id");
          const existingFeatureIds = (existingFeatures || []).map((r) => r.id);
          const incomingFeatureIds = incomingFeatures
            .map((i) => i.id)
            .filter(Boolean);
          const toDeleteFeatures = existingFeatureIds.filter(
            (id) => !incomingFeatureIds.includes(id),
          );
          if (toDeleteFeatures.length) {
            const { error } = await supabase
              .from("features")
              .delete()
              .in("id", toDeleteFeatures);
            if (error) throw error;
          }
          for (const item of incomingFeatures) {
            const payloadF = {
              icon: item.icon || null,
              label: item.label || null,
              group_name: item.group_name || null,
              meta: item.meta || null,
            };
            if (item.id) {
              const { error } = await supabase
                .from("features")
                .update(payloadF)
                .eq("id", item.id);
              if (error) throw error;
            } else {
              const { error } = await supabase
                .from("features")
                .insert([payloadF]);
              if (error) throw error;
            }
          }

          // testimonials
          const incomingTestimonials = data.testimonials || [];
          const { data: existingTestimonials } = await supabase
            .from("testimonials")
            .select("id");
          const existingTestIds = (existingTestimonials || []).map((r) => r.id);
          const incomingTestIds = incomingTestimonials
            .map((i) => i.id)
            .filter(Boolean);
          const toDeleteTests = existingTestIds.filter(
            (id) => !incomingTestIds.includes(id),
          );
          if (toDeleteTests.length) {
            const { error } = await supabase
              .from("testimonials")
              .delete()
              .in("id", toDeleteTests);
            if (error) throw error;
          }
          for (const item of incomingTestimonials) {
            const payloadT = {
              quote: item.quote || null,
              name: item.name || null,
              role: item.role || null,
              avatar: item.avatar || null,
            };
            if (item.id) {
              const { error } = await supabase
                .from("testimonials")
                .update(payloadT)
                .eq("id", item.id);
              if (error) throw error;
            } else {
              const { error } = await supabase
                .from("testimonials")
                .insert([payloadT]);
              if (error) throw error;
            }
          }

          // facilities (separate table linked to pages.id)
          try {
            const incomingFacilities = data.facilities || [];
            // get current page id
            const pageId = (pageRow && pageRow.id) || null;
            if (pageId) {
              const { data: existingFacilities } = await supabase
                .from("facilities")
                .select("id")
                .eq("page_id", pageId);
              const existingFacilityIds = (existingFacilities || []).map(
                (r) => r.id,
              );
              const incomingFacilityIds = incomingFacilities
                .map((i) => i.id)
                .filter(Boolean);
              const toDeleteFacilities = existingFacilityIds.filter(
                (id) => !incomingFacilityIds.includes(id),
              );
              if (toDeleteFacilities.length) {
                const { error } = await supabase
                  .from("facilities")
                  .delete()
                  .in("id", toDeleteFacilities);
                if (error) throw error;
              }

              for (const item of incomingFacilities) {
                const payloadF = {
                  title: item.title || null,
                  description: item.description || null,
                  images: item.images || null,
                };
                if (item.id) {
                  const { error } = await supabase
                    .from("facilities")
                    .update(payloadF)
                    .eq("id", item.id);
                  if (error) throw error;
                } else {
                  const { error } = await supabase
                    .from("facilities")
                    .insert([{ page_id: pageId, ...payloadF }]);
                  if (error) throw error;
                }
              }
            }
          } catch (e) {
            console.error("Facilities sync failed:", e);
            throw e;
          }
        }
      } else if (isRoomView(view)) {
        // support dynamic views like 'room-<id>' or 'accom-<id>'
        const payload = {
          title: data.title || null,
          extended_title: data.extended_title || data.extendedTitle || null,
          description: data.description || null,
          price: normalizePrice(data.price),
          tags: data.tags || null,
          images: data.images || null,
        };
        let idToUse = null;
        const parts = (view || "").split("-");
        const idPart = parts[1];
        if (/^\d+$/.test(idPart)) idToUse = parseInt(idPart, 10);

        if (idToUse) {
          // update by id
          const exists = !!data?.id;
          if (exists) {
            const { data: updated, error } = await supabase
              .from("accommodations")
              .update(payload)
              .eq("id", data.id)
              .select()
              .maybeSingle();
            if (error) throw error;
            setData(updated || data);
          } else {
            // ensure slug exists when inserting a new accommodation
            const computedSlug =
              data.slug || slugify(data.title) || `room-${Date.now()}`;
            const { data: inserted, error } = await supabase
              .from("accommodations")
              .insert([{ slug: computedSlug, ...payload }])
              .select()
              .maybeSingle();
            if (error) throw error;
            setData(inserted || data);
            idToUse = inserted?.id || idToUse;
          }

          // persist pages detail using slug if present
          try {
            const { data: accRow } = await supabase
              .from("accommodations")
              .select("id,slug")
              .eq("id", idToUse)
              .maybeSingle();
            const detailSlug =
              accRow && accRow.slug
                ? `${accRow.slug}-detail`
                : `${idToUse}-detail`;
            const contentObj = {
              description: data.description || null,
              images: data.images || null,
              complimentary: data.complimentary || null,
              price: normalizePrice(data.price),
              availability_heading: data.availability_heading || null,
            };

            const { data: existingPage } = await supabase
              .from("pages")
              .select("*")
              .eq("slug", detailSlug)
              .maybeSingle();
            if (existingPage) {
              await supabase
                .from("pages")
                .update({
                  content: { ...(existingPage.content || {}), ...contentObj },
                  updated_at: new Date().toISOString(),
                })
                .eq("id", existingPage.id);
            } else {
              await supabase.from("pages").insert([
                {
                  slug: detailSlug,
                  content: contentObj,
                  updated_at: new Date().toISOString(),
                },
              ]);
            }
          } catch (e) {
            console.error("Failed to persist detail page content:", e);
          }
        }
      } else if (view === "contact") {
        const payload = {
          resort_name: data.resort_name || null,
          address: data.address || null,
          phones: data.phones || null,
          email: data.email || null,
          map_url: data.map_url || null,
          social: data.social || null,
          updated_at: new Date().toISOString(),
        };
        if (data?.id) {
          const { data: updated, error } = await supabase
            .from("contact_info")
            .update(payload)
            .eq("id", data.id)
            .select()
            .maybeSingle();
          if (error) throw error;
          setData(updated || data);
        } else {
          const { data: inserted, error } = await supabase
            .from("contact_info")
            .insert([payload])
            .select()
            .maybeSingle();
          if (error) throw error;
          setData(inserted || data);
        }
      } else if (view === "gallery") {
        // sync gallery images: update existing, insert new, delete removed
        const incoming = data.images || [];
        const { data: existingRows, error: errExisting } = await supabase
          .from("gallery_images")
          .select("id");
        if (errExisting) throw errExisting;
        const existingIds = (existingRows || []).map((r) => r.id);
        const incomingIds = incoming.map((i) => i.id).filter(Boolean);

        const toDelete = existingIds.filter((id) => !incomingIds.includes(id));
        if (toDelete.length) {
          const { error } = await supabase
            .from("gallery_images")
            .delete()
            .in("id", toDelete);
          if (error) throw error;
        }

        const updatedImages = [];
        for (const item of incoming) {
          if (item.id) {
            const { data: updated, error } = await supabase
              .from("gallery_images")
              .update({ label: item.label, url: item.url })
              .eq("id", item.id)
              .select()
              .maybeSingle();
            if (error) throw error;
            updatedImages.push(updated || item);
          } else {
            const { data: inserted, error } = await supabase
              .from("gallery_images")
              .insert([{ label: item.label, url: item.url }])
              .select();
            if (error) throw error;
            if (Array.isArray(inserted)) updatedImages.push(...inserted);
          }
        }
        if (updatedImages.length) setData({ images: updatedImages });

        // Also persist gallery video_url into pages.slug='gallery' so frontend can read it
        try {
          const videoVal = data.video_url || null;
          if (videoVal !== null) {
            const { data: existingPage } = await supabase
              .from("pages")
              .select("*")
              .eq("slug", "gallery")
              .maybeSingle();
            if (existingPage) {
              await supabase
                .from("pages")
                .update({
                  content: {
                    ...(existingPage.content || {}),
                    video_url: videoVal,
                  },
                  updated_at: new Date().toISOString(),
                })
                .eq("id", existingPage.id);
            } else {
              await supabase.from("pages").insert([
                {
                  slug: "gallery",
                  content: { video_url: videoVal },
                  updated_at: new Date().toISOString(),
                },
              ]);
            }
          }
        } catch (e) {
          console.error("Failed to persist gallery video_url:", e);
        }
      }

      setStatus("Saved to Supabase");
      // reload to reflect DB ids
      await loadData(view);
      setTimeout(() => setStatus(""), 1800);
    } catch (err) {
      console.error(err);
      setError(err.message || "Save failed");
    } finally {
      setLoading(false);
    }
  }

  if (data === null)
    return <div className="calendar-admin-card">Loading...</div>;

  return (
    <div className="calendar-admin-card">
      <div className="calendar-admin-card__header">
        <div>
          <h2>Edit: {view}</h2>
          <p className="calendar-admin-copy">
            Edit the content below. Changes are saved to Supabase.
          </p>
          {error && (
            <div style={{ color: "#8c3535", marginTop: 8 }}>{error}</div>
          )}
        </div>
      </div>

      <div style={{ display: "grid", gap: 12 }}>
        {/* Render form fields based on view */}
        {view === "home" && (
          <>
            <div style={{ marginTop: 8 }}>
              <SupabaseImageUploader
                label="Hero image"
                value={data.hero_image || ""}
                onChange={(v) => handleChange("hero_image", v)}
              />
            </div>

            <label className="calendar-admin-field">
              <span>Hero heading</span>
              <input
                value={data.hero_heading || ""}
                onChange={(e) => handleChange("hero_heading", e.target.value)}
              />
            </label>

            <label className="calendar-admin-field">
              <span>Hero subtext</span>
              <input
                value={data.hero_subtext || ""}
                onChange={(e) => handleChange("hero_subtext", e.target.value)}
              />
            </label>

            <div style={{ marginTop: 8 }}>
              <SupabaseImageUploader
                label="Offer popup image"
                value={(data.content && data.content.offer_image) || ""}
                onChange={(v) =>
                  handleChange("content", {
                    ...(data.content || {}),
                    offer_image: v,
                  })
                }
              />
            </div>

            <div style={{ marginTop: 8 }}>
              <SupabaseImageUploader
                label="Sticky banner image"
                value={(data.content && data.content.banner_image) || ""}
                onChange={(v) =>
                  handleChange("content", {
                    ...(data.content || {}),
                    banner_image: v,
                  })
                }
              />
            </div>

            <hr />

            <div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <h3>Accommodations</h3>
                <button
                  className="calendar-admin-add-button"
                  onClick={() =>
                    handleAddList("accommodations", {
                      title: "",
                      description: "",
                      extended_title: "",
                      price: "",
                      coupon_code: "",
                      discount_value: "",
                      tags: [],
                      images: [],
                    })
                  }
                >
                  Add
                </button>
              </div>
              {(data.accommodations || []).map((acc, i) => (
                <div
                  key={i}
                  style={{ border: "1px solid #eee", padding: 8, marginTop: 8 }}
                >
                  <label className="calendar-admin-field">
                    <span>Title</span>
                    <input
                      value={acc.title || ""}
                      onChange={(e) =>
                        handleListChange(
                          "accommodations",
                          i,
                          "title",
                          e.target.value,
                        )
                      }
                    />
                  </label>
                  <label className="calendar-admin-field">
                    <span>Description</span>
                    <input
                      value={acc.description || ""}
                      onChange={(e) =>
                        handleListChange(
                          "accommodations",
                          i,
                          "description",
                          e.target.value,
                        )
                      }
                    />
                  </label>
                  <label className="calendar-admin-field">
                    <span>Extended title</span>
                    <input
                      value={acc.extended_title || acc.extendedTitle || ""}
                      onChange={(e) =>
                        handleListChange(
                          "accommodations",
                          i,
                          "extended_title",
                          e.target.value,
                        )
                      }
                    />
                  </label>
                  <label className="calendar-admin-field">
                    <span>Price</span>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={acc.price ?? ""}
                      onChange={(e) =>
                        handleListChange(
                          "accommodations",
                          i,
                          "price",
                          e.target.value,
                        )
                      }
                    />
                  </label>
                  <label className="calendar-admin-field">
                    <span>Coupon code</span>
                    <input
                      value={acc.coupon_code || ""}
                      onChange={(e) =>
                        handleListChange(
                          "accommodations",
                          i,
                          "coupon_code",
                          e.target.value,
                        )
                      }
                    />
                  </label>
                  <label className="calendar-admin-field">
                    <span>Discount value</span>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={acc.discount_value ?? ""}
                      onChange={(e) =>
                        handleListChange(
                          "accommodations",
                          i,
                          "discount_value",
                          e.target.value,
                        )
                      }
                    />
                  </label>
                  <label className="calendar-admin-field">
                    <span>Tags (comma or space separated)</span>
                    <input
                      value={accomTagInputs[i] ?? (acc.tags || []).join(", ")}
                      onChange={(e) =>
                        setAccomTagInputs((p) => ({ ...(p || {}), [i]: e.target.value }))
                      }
                      onBlur={(e) =>
                        handleListChange(
                          "accommodations",
                          i,
                          "tags",
                          parseTagsFromString(e.target.value),
                        )
                      }
                    />
                  </label>
                  <div style={{ marginTop: 8 }}>
                    <div style={{ fontSize: 13, marginBottom: 6 }}>Images</div>
                    {(acc.images || []).map((imgUrl, j) => (
                      <div
                        key={j}
                        style={{
                          display: "flex",
                          gap: 8,
                          alignItems: "center",
                          marginTop: 6,
                        }}
                      >
                        <SupabaseImageUploader
                          value={imgUrl}
                          onChange={(v) => {
                            const arr = Array.isArray(acc.images)
                              ? [...acc.images]
                              : [];
                            arr[j] = v;
                            handleListChange(
                              "accommodations",
                              i,
                              "images",
                              arr,
                            );
                          }}
                          label={`Image ${j + 1}`}
                        />
                        <button
                          className="calendar-admin-add-button"
                          onClick={() => {
                            const arr = Array.isArray(acc.images)
                              ? [...acc.images]
                              : [];
                            arr.splice(j, 1);
                            handleListChange(
                              "accommodations",
                              i,
                              "images",
                              arr,
                            );
                          }}
                        >
                          Remove
                        </button>
                      </div>
                    ))}

                    <div style={{ marginTop: 8 }}>
                      <button
                        className="calendar-admin-add-button"
                        onClick={() => {
                          const arr = Array.isArray(acc.images)
                            ? [...acc.images]
                            : [];
                          arr.push("");
                          handleListChange("accommodations", i, "images", arr);
                        }}
                      >
                        Add image
                      </button>
                    </div>
                  </div>
                  <div>
                    <button
                      className="calendar-admin-add-button"
                      onClick={() => handleRemoveList("accommodations", i)}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <hr />

            <div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <h3>Features</h3>
                <button
                  className="calendar-admin-add-button"
                  onClick={() =>
                    handleAddList("features", {
                      icon: "",
                      label: "",
                      group_name: "features",
                    })
                  }
                >
                  Add
                </button>
              </div>
              {(data.features || []).map((f, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    gap: 8,
                    marginTop: 8,
                    alignItems: "center",
                  }}
                >
                  <input
                    style={{ flex: 1 }}
                    value={f.icon || ""}
                    onChange={(e) =>
                      handleListChange("features", i, "icon", e.target.value)
                    }
                    placeholder="icon"
                  />
                  <input
                    style={{ flex: 2 }}
                    value={f.label || ""}
                    onChange={(e) =>
                      handleListChange("features", i, "label", e.target.value)
                    }
                    placeholder="label"
                  />
                  <input
                    style={{ flex: 1 }}
                    value={f.group_name || "features"}
                    onChange={(e) =>
                      handleListChange(
                        "features",
                        i,
                        "group_name",
                        e.target.value,
                      )
                    }
                    placeholder="group"
                  />
                  <button
                    className="calendar-admin-add-button"
                    onClick={() => handleRemoveList("features", i)}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>

            <hr />

            <div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <h3>Testimonials</h3>
                <button
                  className="calendar-admin-add-button"
                  onClick={() =>
                    handleAddList("testimonials", {
                      quote: "",
                      name: "",
                      role: "",
                      avatar: "",
                    })
                  }
                >
                  Add
                </button>
              </div>
              {(data.testimonials || []).map((t, i) => (
                <div
                  key={i}
                  style={{ border: "1px solid #eee", padding: 8, marginTop: 8 }}
                >
                  <label className="calendar-admin-field">
                    <span>Quote</span>
                    <input
                      value={t.quote || ""}
                      onChange={(e) =>
                        handleListChange(
                          "testimonials",
                          i,
                          "quote",
                          e.target.value,
                        )
                      }
                    />
                  </label>
                  <label className="calendar-admin-field">
                    <span>Name</span>
                    <input
                      value={t.name || ""}
                      onChange={(e) =>
                        handleListChange(
                          "testimonials",
                          i,
                          "name",
                          e.target.value,
                        )
                      }
                    />
                  </label>
                  <label className="calendar-admin-field">
                    <span>Role</span>
                    <input
                      value={t.role || ""}
                      onChange={(e) =>
                        handleListChange(
                          "testimonials",
                          i,
                          "role",
                          e.target.value,
                        )
                      }
                    />
                  </label>
                  <div style={{ marginTop: 8 }}>
                    <SupabaseImageUploader
                      label="Avatar"
                      value={t.avatar || ""}
                      onChange={(v) =>
                        handleListChange("testimonials", i, "avatar", v)
                      }
                    />
                  </div>
                  <div>
                    <button
                      className="calendar-admin-add-button"
                      onClick={() => handleRemoveList("testimonials", i)}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <hr />

            <div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <h3>Facilities</h3>
                <button
                  className="calendar-admin-add-button"
                  onClick={() =>
                    handleAddList("facilities", {
                      title: "",
                      description: "",
                      images: ["", "", "", ""],
                    })
                  }
                >
                  Add
                </button>
              </div>

              {(data.facilities || []).map((f, fi) => (
                <div
                  key={fi}
                  style={{ border: "1px solid #eee", padding: 8, marginTop: 8 }}
                >
                  <label className="calendar-admin-field">
                    <span>Title</span>
                    <input
                      value={f.title || ""}
                      onChange={(e) =>
                        handleListChange(
                          "facilities",
                          fi,
                          "title",
                          e.target.value,
                        )
                      }
                    />
                  </label>

                  <label className="calendar-admin-field">
                    <span>Description</span>
                    <input
                      value={f.description || ""}
                      onChange={(e) =>
                        handleListChange(
                          "facilities",
                          fi,
                          "description",
                          e.target.value,
                        )
                      }
                    />
                  </label>

                  <div>
                    <div style={{ fontSize: 13, marginBottom: 6 }}>
                      Images (4)
                    </div>
                    {(f.images || ["", "", "", ""])
                      .slice(0, 4)
                      .map((imgUrl, k) => (
                        <div
                          key={k}
                          style={{
                            display: "flex",
                            gap: 8,
                            alignItems: "center",
                            marginTop: 6,
                          }}
                        >
                          <SupabaseImageUploader
                            value={imgUrl || ""}
                            onChange={(v) => {
                              const arr = Array.isArray(f.images)
                                ? [...f.images]
                                : ["", "", "", ""];
                              arr[k] = v;
                              handleListChange("facilities", fi, "images", arr);
                            }}
                            label={`Image ${k + 1}`}
                          />
                          <button
                            className="calendar-admin-add-button"
                            onClick={() => {
                              const arr = Array.isArray(f.images)
                                ? [...f.images]
                                : ["", "", "", ""];
                              arr.splice(k, 1);
                              handleListChange("facilities", fi, "images", arr);
                            }}
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                  </div>

                  <div style={{ marginTop: 8 }}>
                    <button
                      className="calendar-admin-add-button"
                      onClick={() => handleRemoveList("facilities", fi)}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {isRoomView(view) && (
          <>
            <hr />
            <h3>Calendar Status (admin)</h3>
            <p>
              Manage availability for this room. Changes apply immediately to
              the DB.
            </p>

            <label className="calendar-admin-field">
              <span>Selected date</span>
              <input
                type="date"
                value={roomSelectedDate}
                onChange={(e) => setRoomSelectedDate(e.target.value)}
              />
            </label>

            <div
              style={{
                display: "flex",
                gap: 8,
                alignItems: "center",
                marginBottom: 8,
              }}
            >
              <select
                value={data && (data._pending_status || "booked")}
                onChange={(e) =>
                  handleChange("_pending_status", e.target.value)
                }
              >
                <option value="booked">booked</option>
                <option value="almost">almost</option>
                <option value="free">free</option>
              </select>
              <button
                className="calendar-admin-add-button"
                onClick={async () => {
                  const roomId = roomKey || getRoomKeyFromAcc(data) || null;
                  const statusVal = (data && data._pending_status) || "booked";
                  if (!roomSelectedDate) return alert("Pick a date");
                  try {
                    await upsertRoomDate(roomId, roomSelectedDate, statusVal);
                    setRoomSelectedDate("");
                  } catch (e) {
                    alert("Failed to set date in DB");
                  }
                }}
              >
                Set status
              </button>
            </div>

            <div style={{ marginTop: 12 }}>
              <h4>Existing dates</h4>
              {(!roomCalendar ||
                (!roomCalendar.booked.length &&
                  !roomCalendar.almost.length &&
                  !roomCalendar.free.length)) && (
                <div className="calendar-admin-empty">No dates yet.</div>
              )}
              {Array.from(
                new Set([
                  ...(roomCalendar.booked || []),
                  ...(roomCalendar.almost || []),
                  ...(roomCalendar.free || []),
                ]),
              )
                .sort()
                .map((d) => (
                  <div
                    key={d}
                    style={{
                      display: "flex",
                      gap: 8,
                      alignItems: "center",
                      marginTop: 8,
                    }}
                  >
                    <div style={{ width: 120 }}>{d}</div>
                    <select
                      defaultValue={
                        roomCalendar.booked.includes(d)
                          ? "booked"
                          : roomCalendar.almost.includes(d)
                            ? "almost"
                            : "free"
                      }
                      onChange={async (e) => {
                        const roomId = roomKey;
                        if (!roomId) return alert("No room selected");
                        try {
                          await upsertRoomDate(roomId, d, e.target.value);
                        } catch (err) {
                          alert("Update failed");
                        }
                      }}
                    >
                      <option value="booked">booked</option>
                      <option value="almost">almost</option>
                      <option value="free">free</option>
                    </select>
                    <button
                      className="calendar-admin-chip-remove"
                      onClick={async () => {
                        const roomId = roomKey;
                        if (!roomId) return alert("No room selected");
                        try {
                          await deleteRoomDate(roomId, d);
                        } catch (err) {
                          alert("Delete failed");
                        }
                      }}
                    >
                      Remove
                    </button>
                  </div>
                ))}
            </div>
          </>
        )}

        {view === "gallery" && (
          <>
            <label className="calendar-admin-field">
              <span>Video URL (YouTube embed link)</span>
              <input
                value={data.video_url || ""}
                onChange={(e) => handleChange("video_url", e.target.value)}
              />
            </label>

            <div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <h3>Images</h3>
                <button
                  className="calendar-admin-add-button"
                  onClick={() =>
                    handleAddList("images", { label: "", url: "" })
                  }
                >
                  Add image
                </button>
              </div>

              {(data.images || []).map((img, i) => (
                <div
                  key={i}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr auto",
                    gap: 8,
                    alignItems: "center",
                    marginTop: 8,
                  }}
                >
                  <div>
                    <label className="calendar-admin-field">
                      <span>Label</span>
                      <input
                        value={img.label || ""}
                        onChange={(e) =>
                          handleListChange("images", i, "label", e.target.value)
                        }
                      />
                    </label>
                    <div style={{ marginTop: 6 }}>
                      <SupabaseImageUploader
                        label="Image URL"
                        value={img.url || ""}
                        onChange={(v) =>
                          handleListChange("images", i, "url", v)
                        }
                      />
                    </div>
                  </div>

                  <div>
                    <button
                      className="calendar-admin-add-button"
                      onClick={() => handleRemoveList("images", i)}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {isRoomView(view) && (
          <>
            <label className="calendar-admin-field">
              <span>Title</span>
              <input
                value={data.title || ""}
                onChange={(e) => handleChange("title", e.target.value)}
              />
            </label>

            <label className="calendar-admin-field">
              <span>Extended title</span>
              <input
                value={data.extended_title || data.extendedTitle || ""}
                onChange={(e) => handleChange("extended_title", e.target.value)}
              />
            </label>

            <label className="calendar-admin-field">
              <span>Description</span>
              <input
                value={data.description || ""}
                onChange={(e) => handleChange("description", e.target.value)}
              />
            </label>

            <label className="calendar-admin-field">
              <span>Price</span>
              <input
                type="number"
                min="0"
                step="1"
                value={data.price ?? ""}
                onChange={(e) => handleChange("price", e.target.value)}
              />
            </label>

            <div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <h3>Images</h3>
                <button
                  className="calendar-admin-add-button"
                  onClick={() => handleAddList("images", "")}
                >
                  Add image
                </button>
              </div>

              {(data.images || []).map((img, ii) => (
                <div
                  key={ii}
                  style={{
                    display: "flex",
                    gap: 8,
                    marginTop: 8,
                    alignItems: "center",
                  }}
                >
                  <SupabaseImageUploader
                    value={img || ""}
                    onChange={(v) => {
                      const arr = [...(data.images || [])];
                      arr[ii] = v;
                      setData((prev) => ({ ...prev, images: arr }));
                    }}
                    label={`Image ${ii + 1}`}
                  />
                  <button
                    className="calendar-admin-add-button"
                    onClick={() => {
                      const arr = [...(data.images || [])];
                      arr.splice(ii, 1);
                      setData((prev) => ({ ...prev, images: arr }));
                    }}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>

            <label className="calendar-admin-field">
              <span>Tags (comma or space separated)</span>
              <input
                value={tagInputMain}
                onChange={(e) => setTagInputMain(e.target.value)}
                onBlur={(e) => handleChange("tags", parseTagsFromString(e.target.value))}
              />
            </label>

            <hr />

            <div>
              <h3>Complimentary items</h3>
              <div style={{ marginTop: 8 }}>
                {(data.complimentary || []).map((item, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      gap: 8,
                      alignItems: "center",
                      marginTop: 6,
                    }}
                  >
                    <input
                      style={{ flex: 1 }}
                      value={item || ""}
                      onChange={(e) => {
                        const arr = Array.isArray(data.complimentary)
                          ? [...data.complimentary]
                          : [];
                        arr[i] = e.target.value;
                        handleChange("complimentary", arr);
                      }}
                    />
                    <button
                      className="calendar-admin-add-button"
                      onClick={() => {
                        const arr = Array.isArray(data.complimentary)
                          ? [...data.complimentary]
                          : [];
                        arr.splice(i, 1);
                        handleChange("complimentary", arr);
                      }}
                    >
                      Remove
                    </button>
                  </div>
                ))}

                <div style={{ marginTop: 8 }}>
                  <button
                    className="calendar-admin-add-button"
                    onClick={() => handleAddList("complimentary", "")}
                  >
                    Add item
                  </button>
                </div>
              </div>
            </div>

            <label className="calendar-admin-field" style={{ marginTop: 8 }}>
              <span>Availability heading</span>
              <input
                value={data.availability_heading || ""}
                onChange={(e) =>
                  handleChange("availability_heading", e.target.value)
                }
              />
            </label>
          </>
        )}

        {view === "about" && (
          <>
            <h3>Mission</h3>
            <label className="calendar-admin-field">
              <span>Heading</span>
              <input
                value={
                  (data.content &&
                    data.content.mission &&
                    data.content.mission.heading) ||
                  ""
                }
                onChange={(e) =>
                  handleChange("content", {
                    ...(data.content || {}),
                    mission: {
                      ...(data.content?.mission || {}),
                      heading: e.target.value,
                    },
                  })
                }
              />
            </label>
            <label className="calendar-admin-field">
              <span>Text</span>
              <input
                value={
                  (data.content &&
                    data.content.mission &&
                    data.content.mission.text) ||
                  ""
                }
                onChange={(e) =>
                  handleChange("content", {
                    ...(data.content || {}),
                    mission: {
                      ...(data.content?.mission || {}),
                      text: e.target.value,
                    },
                  })
                }
              />
            </label>

            <hr />

            <h3>Vision</h3>
            <label className="calendar-admin-field">
              <span>Heading</span>
              <input
                value={
                  (data.content &&
                    data.content.vision &&
                    data.content.vision.heading) ||
                  ""
                }
                onChange={(e) =>
                  handleChange("content", {
                    ...(data.content || {}),
                    vision: {
                      ...(data.content?.vision || {}),
                      heading: e.target.value,
                    },
                  })
                }
              />
            </label>
            <label className="calendar-admin-field">
              <span>Text</span>
              <input
                value={
                  (data.content &&
                    data.content.vision &&
                    data.content.vision.text) ||
                  ""
                }
                onChange={(e) =>
                  handleChange("content", {
                    ...(data.content || {}),
                    vision: {
                      ...(data.content?.vision || {}),
                      text: e.target.value,
                    },
                  })
                }
              />
            </label>
            <div style={{ marginTop: 8 }}>
              <SupabaseImageUploader
                label="Vision background image"
                value={
                  (data.content &&
                    data.content.vision &&
                    data.content.vision.bg_image) ||
                  ""
                }
                onChange={(v) =>
                  handleChange("content", {
                    ...(data.content || {}),
                    vision: { ...(data.content?.vision || {}), bg_image: v },
                  })
                }
              />
            </div>

            <hr />

            <h3>Values</h3>
            <label className="calendar-admin-field">
              <span>Heading</span>
              <input
                value={
                  (data.content &&
                    data.content.values &&
                    data.content.values.heading) ||
                  ""
                }
                onChange={(e) =>
                  handleChange("content", {
                    ...(data.content || {}),
                    values: {
                      ...(data.content?.values || {}),
                      heading: e.target.value,
                    },
                  })
                }
              />
            </label>
            <label className="calendar-admin-field">
              <span>Text</span>
              <input
                value={
                  (data.content &&
                    data.content.values &&
                    data.content.values.text) ||
                  ""
                }
                onChange={(e) =>
                  handleChange("content", {
                    ...(data.content || {}),
                    values: {
                      ...(data.content?.values || {}),
                      text: e.target.value,
                    },
                  })
                }
              />
            </label>

            <hr />

            <h3>Founder</h3>
            <label className="calendar-admin-field">
              <span>Heading</span>
              <input
                value={
                  (data.content &&
                    data.content.founder &&
                    data.content.founder.heading) ||
                  ""
                }
                onChange={(e) =>
                  handleChange("content", {
                    ...(data.content || {}),
                    founder: {
                      ...(data.content?.founder || {}),
                      heading: e.target.value,
                    },
                  })
                }
              />
            </label>
            <label className="calendar-admin-field">
              <span>Text</span>
              <input
                value={
                  (data.content &&
                    data.content.founder &&
                    data.content.founder.text) ||
                  ""
                }
                onChange={(e) =>
                  handleChange("content", {
                    ...(data.content || {}),
                    founder: {
                      ...(data.content?.founder || {}),
                      text: e.target.value,
                    },
                  })
                }
              />
            </label>
            <div style={{ marginTop: 8 }}>
              <SupabaseImageUploader
                label="Founder image"
                value={
                  (data.content &&
                    data.content.founder &&
                    data.content.founder.image) ||
                  ""
                }
                onChange={(v) =>
                  handleChange("content", {
                    ...(data.content || {}),
                    founder: { ...(data.content?.founder || {}), image: v },
                  })
                }
              />
            </div>
          </>
        )}

        {view === "contact" && (
          <>
            <label className="calendar-admin-field">
              <span>Resort name</span>
              <input
                value={data.resort_name || ""}
                onChange={(e) => handleChange("resort_name", e.target.value)}
              />
            </label>
            <label className="calendar-admin-field">
              <span>Address</span>
              <input
                value={data.address || ""}
                onChange={(e) => handleChange("address", e.target.value)}
              />
            </label>
            <label className="calendar-admin-field">
              <span>Phones (comma or space separated)</span>
              <input
                value={(data.phones || []).join(", ")}
                onChange={(e) =>
                  handleChange(
                    "phones",
                    e.target.value
                      .split(/[,\s]+/)
                      .map((t) => t.trim())
                      .filter((t) => t.length > 0),
                  )
                }
              />
            </label>
            <label className="calendar-admin-field">
              <span>Email</span>
              <input
                value={data.email || ""}
                onChange={(e) => handleChange("email", e.target.value)}
              />
            </label>
            <label className="calendar-admin-field">
              <span>Map URL</span>
              <input
                value={data.map_url || ""}
                onChange={(e) => handleChange("map_url", e.target.value)}
              />
            </label>
            <div>
              <h3>Social links</h3>
              {Object.keys(data.social || {}).map((k) => (
                <label key={k} className="calendar-admin-field">
                  <span>{k}</span>
                  <input
                    value={(data.social || {})[k] || ""}
                    onChange={(e) =>
                      setData((prev) => ({
                        ...prev,
                        social: { ...(prev.social || {}), [k]: e.target.value },
                      }))
                    }
                  />
                </label>
              ))}
            </div>
          </>
        )}

        <div className="calendar-admin-savebar">
          <div className="calendar-admin-savebar__actions">
            {status && <span className="calendar-admin-saved">{status}</span>}
            <button className="calendar-admin-save-button" onClick={handleSave}>
              Save
            </button>
          </div>
        </div>

        {/* Current data preview */}
        <div className="calendar-admin-list-wrap">
          <div className="calendar-admin-list-header">
            <h3>Current data preview</h3>
            <span>Rendered preview of the values below</span>
          </div>

          <div style={{ padding: 12 }}>
            <pre style={{ whiteSpace: "pre-wrap", fontSize: 13 }}>
              {JSON.stringify(data, null, 2)}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
