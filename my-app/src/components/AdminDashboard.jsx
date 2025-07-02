import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import './AdminDashboard.css';
import ReactModal from 'react-modal';
import { useNavigate } from 'react-router-dom';

const sections = [
  { key: 'restaurants', label: 'Restaurants' },
  { key: 'biryani', label: 'Biryani Points' },
  { key: 'pickles', label: 'Pickles' },
  { key: 'tiffins', label: 'Tiffins' },
];

const BUCKET = 'admin-photos';

// Helper: Get zipcode from location using Nominatim
async function getZipcodeFromLocation(location) {
  if (!location) return '';
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(location)}&addressdetails=1&limit=1`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    if (data && data.length > 0 && data[0].address && data[0].address.postcode) {
      return data[0].address.postcode;
    }
  } catch (e) {
    // ignore
  }
  return '';
}

// Helper: Get lat/lng from zipcode using Nominatim
async function getLatLngFromZip(zipcode, country = 'India') {
  if (!zipcode) return { lat: null, lon: null };
  let url = `https://nominatim.openstreetmap.org/search?postalcode=${zipcode}&country=${country}&format=json&limit=1`;
  try {
    let res = await fetch(url);
    let data = await res.json();
    if (data && data.length > 0) {
      return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
    }
    // Fallback to US if India fails
    if (country === 'India') {
      url = `https://nominatim.openstreetmap.org/search?postalcode=${zipcode}&country=United States&format=json&limit=1`;
      res = await fetch(url);
      data = await res.json();
      if (data && data.length > 0) {
        return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
      }
    }
  } catch (e) {}
  return { lat: null, lon: null };
}

const AdminDashboard = () => {
  const [items, setItems] = useState({
    restaurants: [],
    biryani: [],
    pickles: [],
    tiffins: [],
  });
  const [selectedSection, setSelectedSection] = useState('restaurants');
  const [selectedParent, setSelectedParent] = useState('');
  const [dishForm, setDishForm] = useState({
    photo: '',
    photoFile: null,
    name: '',
    price: '',
  });
  const [dishes, setDishes] = useState({}); // { parentId: [dish, ...] }
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [parentForm, setParentForm] = useState({
    photo: '',
    photoFile: null,
    name: '',
    location: '',
    zipcode: '',
  });
  const [parentLoading, setParentLoading] = useState(false);
  const [parentError, setParentError] = useState('');
  const [editingParentId, setEditingParentId] = useState(null);
  const [editParentForm, setEditParentForm] = useState({ photo: '', photoFile: null, name: '', location: '', zipcode: '' });
  const [editingDish, setEditingDish] = useState({ parentId: null, idx: null });
  const [editDishForm, setEditDishForm] = useState({ photo: '', photoFile: null, name: '', price: '' });
  const editParentPhotoInput = useRef();
  const editDishPhotoInput = useRef();
  const [success, setSuccess] = useState('');
  const [dishSearch, setDishSearch] = useState({}); // { parentId: searchString }
  const [menuModalParent, setMenuModalParent] = useState(null);
  const parentCardRefs = useRef({});
  const [parentSearch, setParentSearch] = useState({}); // { sectionKey: searchString }
  const [parentModal, setParentModal] = useState(null);
  const navigate = useNavigate();
  const [locationSuggestions, setLocationSuggestions] = useState([]);
  const [showLocationDropdown, setShowLocationDropdown] = useState(false);
  const locationInputRef = useRef();
  let locationDebounceTimeout = useRef();
  const [autoZipLoading, setAutoZipLoading] = useState(false);
  const [autoZipError, setAutoZipError] = useState('');
  ReactModal.setAppElement('#root');

  // Fetch items from Supabase on mount
  useEffect(() => {
    const fetchItems = async () => {
      const { data, error } = await supabase
        .from('admin_items')
        .select('*');
      if (error) return;
      const grouped = { restaurants: [], biryani: [], pickles: [], tiffins: [] };
      data.forEach(item => {
        if (grouped[item.section]) grouped[item.section].push(item);
      });
      setItems(grouped);
    };
    fetchItems();
  }, []);

  // Reset parent selection when section changes
  useEffect(() => {
    setSelectedParent('');
  }, [selectedSection]);

  // Fetch dishes for all parents
  const fetchDishesForAllParents = async (parents) => {
    const allDishes = {};
    for (const p of parents) {
      const { data: dishList } = await supabase.from('dishes').select('*').eq('parent_id', p.id);
      allDishes[p.id] = dishList || [];
    }
    setDishes(allDishes);
  };

  // Fetch dishes when items change
  useEffect(() => {
    const allParents = Object.values(items).flat();
    if (allParents.length > 0) fetchDishesForAllParents(allParents);
    else setDishes({});
  }, [items]);

  const handleDishChange = (e) => {
    const { name, value, files } = e.target;
    if (name === 'photo' && files && files[0]) {
      const file = files[0];
      setDishForm((prev) => ({ ...prev, photoFile: file }));
      const reader = new FileReader();
      reader.onload = (ev) => {
        setDishForm((prev) => ({ ...prev, photo: ev.target.result }));
      };
      reader.readAsDataURL(file);
    } else {
      setDishForm((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleDishSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
    let photo_url = '';
    try {
      // 1. Upload photo to Supabase Storage
      if (dishForm.photoFile) {
        const fileExt = dishForm.photoFile.name.split('.').pop();
        const randomStr = Math.random().toString(36).substring(2, 10);
        const fileName = `dishes/${selectedParent}_${Date.now()}_${randomStr}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from(BUCKET)
          .upload(fileName, dishForm.photoFile, { upsert: true });
        if (uploadError) throw uploadError;
        const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(fileName);
        photo_url = urlData.publicUrl;
      }
      // Check for duplicate dish name for the same parent
      const { data: existingDish } = await supabase
        .from('dishes')
        .select('id')
        .eq('parent_id', Number(selectedParent))
        .eq('name', dishForm.name)
        .single();
      if (existingDish) {
        setError('A dish with this name already exists for this restaurant.');
        setLoading(false);
        return;
      }
      // Validate required fields
      if (!selectedParent || !dishForm.name || dishForm.price === '' || isNaN(Number(dishForm.price))) {
        setError('Please fill all required fields correctly.');
        setLoading(false);
        return;
      }
      // Prepare payload with correct types
      const payload = {
        parent_id: Number(selectedParent),
        name: dishForm.name,
        price: Number(dishForm.price),
        photo_url: photo_url || dishForm.photo || null,
      };
      console.log('Inserting dish payload:', payload);
      // 2. Insert dish into Supabase
      const { error: insertError } = await supabase
        .from('dishes')
        .insert([payload]);
      if (insertError) throw insertError;
      // 3. Refetch dishes for this parent
      const { data: dishList } = await supabase.from('dishes').select('*').eq('parent_id', Number(selectedParent));
      setDishes(prev => ({ ...prev, [selectedParent]: dishList || [] }));
      setDishForm({ photo: '', photoFile: null, name: '', price: '' });
      document.getElementById('dish-photo-input').value = '';
      setSuccess('Dish added successfully!');
      setTimeout(() => setSuccess(''), 2000);
    } catch (err) {
      setError('Failed to add dish: ' + (err.message || err));
      setTimeout(() => setError(''), 2000);
    }
    setLoading(false);
  };

  const handleParentChange = (e) => {
    const { name, value, files } = e.target;
    if (name === 'photo' && files && files[0]) {
      const file = files[0];
      setParentForm((prev) => ({ ...prev, photoFile: file }));
      const reader = new FileReader();
      reader.onload = (ev) => {
        setParentForm((prev) => ({ ...prev, photo: ev.target.result }));
      };
      reader.readAsDataURL(file);
    } else {
      setParentForm((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleParentSubmit = async (e) => {
    e.preventDefault();
    setParentError('');
    setParentLoading(true);
    let photo_url = '';
    try {
      if (parentForm.photoFile) {
        const fileExt = parentForm.photoFile.name.split('.').pop();
        const fileName = `${selectedSection}_${Date.now()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from(BUCKET)
          .upload(fileName, parentForm.photoFile, { upsert: true });
        if (uploadError) throw uploadError;
        const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(fileName);
        photo_url = urlData.publicUrl;
      }
      // Validate zipcode (optional, 5-6 digit number)
      if (!/^[0-9]{5,6}$/.test(parentForm.zipcode)) {
        setParentError('Zip code must be a 5 or 6 digit number.');
        setParentLoading(false);
        return;
      }
      // Geocode zipcode
      const { lat, lon } = await getLatLngFromZip(parentForm.zipcode);
      const { error: insertError } = await supabase
        .from('admin_items')
        .insert([
          {
            section: selectedSection,
            name: parentForm.name,
            location: parentForm.location,
            photo_url,
            zipcode: parseInt(parentForm.zipcode, 10),
            latitude: lat,
            longitude: lon,
          },
        ]);
      if (insertError) throw insertError;
      // Refetch items
      const { data: allData } = await supabase.from('admin_items').select('*');
      const grouped = { restaurants: [], biryani: [], pickles: [], tiffins: [] };
      allData.forEach(item => {
        if (grouped[item.section]) grouped[item.section].push(item);
      });
      setItems(grouped);
      setParentForm({ photo: '', photoFile: null, name: '', location: '', zipcode: '' });
      document.getElementById('parent-photo-input').value = '';
    } catch (err) {
      setParentError('Failed to add parent item.');
    }
    setParentLoading(false);
  };

  // Edit parent handlers
  const startEditParent = (item) => {
    setEditingParentId(item.id);
    setEditParentForm({
      photo: item.photo_url,
      photoFile: null,
      name: item.name,
      location: item.location,
      zipcode: item.zipcode ? String(item.zipcode) : '',
    });
  };
  const cancelEditParent = () => {
    setEditingParentId(null);
    setEditParentForm({ photo: '', photoFile: null, name: '', location: '', zipcode: '' });
  };
  const handleEditParentChange = (e) => {
    const { name, value, files } = e.target;
    if (name === 'photo' && files && files[0]) {
      const file = files[0];
      setEditParentForm((prev) => ({ ...prev, photoFile: file }));
      const reader = new FileReader();
      reader.onload = (ev) => {
        setEditParentForm((prev) => ({ ...prev, photo: ev.target.result }));
      };
      reader.readAsDataURL(file);
    } else {
      setEditParentForm((prev) => ({ ...prev, [name]: value }));
    }
  };
  const handleEditParentSubmit = async (e, item) => {
    e.preventDefault();
    let photo_url = item.photo_url;
    try {
      if (editParentForm.photoFile) {
        const fileExt = editParentForm.photoFile.name.split('.').pop();
        const fileName = `${selectedSection}_${item.id}_edit.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from(BUCKET)
          .upload(fileName, editParentForm.photoFile, { upsert: true });
        if (uploadError) throw uploadError;
        const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(fileName);
        photo_url = urlData.publicUrl;
      }
      // Geocode zipcode
      const { lat, lon } = await getLatLngFromZip(editParentForm.zipcode);
      const { error: updateError } = await supabase
        .from('admin_items')
        .update({
          name: editParentForm.name,
          location: editParentForm.location,
          photo_url,
          zipcode: parseInt(editParentForm.zipcode, 10),
          latitude: lat,
          longitude: lon,
        })
        .eq('id', item.id);
      if (updateError) throw updateError;
      // Refetch items
      const { data: allData } = await supabase.from('admin_items').select('*');
      const grouped = { restaurants: [], biryani: [], pickles: [], tiffins: [] };
      allData.forEach(i => { if (grouped[i.section]) grouped[i.section].push(i); });
      setItems(grouped);
      cancelEditParent();
    } catch (err) {
      alert('Failed to update parent item.');
    }
  };
  const handleDeleteParent = async (item) => {
    if (!window.confirm('Delete this item and all its dishes?')) return;
    try {
      // Only delete the parent; ON DELETE CASCADE will handle related dishes and reviews
      const { error } = await supabase.from('admin_items').delete().eq('id', item.id);
      if (error) throw error;
      // Refetch items
      const { data: allData } = await supabase.from('admin_items').select('*');
      const grouped = { restaurants: [], biryani: [], pickles: [], tiffins: [] };
      allData.forEach(i => { if (grouped[i.section]) grouped[i.section].push(i); });
      setItems(grouped);
      // Remove dishes from local state
      setDishes(prev => { const copy = { ...prev }; delete copy[item.id]; return copy; });
    } catch (err) {
      alert('Failed to delete parent item: ' + (err.message || err));
      console.error('Delete error:', err);
    }
  };

  // Edit dish handlers (Supabase)
  const startEditDish = (parentId, idx, dish) => {
    setEditingDish({ parentId, idx });
    setEditDishForm({ photo: dish.photo_url, photoFile: null, name: dish.name, price: dish.price, id: dish.id });
  };
  const cancelEditDish = () => {
    setEditingDish({ parentId: null, idx: null });
    setEditDishForm({ photo: '', photoFile: null, name: '', price: '' });
  };
  const handleEditDishChange = (e) => {
    const { name, value, files } = e.target;
    if (name === 'photo' && files && files[0]) {
      const file = files[0];
      setEditDishForm((prev) => ({ ...prev, photoFile: file }));
      const reader = new FileReader();
      reader.onload = (ev) => {
        setEditDishForm((prev) => ({ ...prev, photo: ev.target.result }));
      };
      reader.readAsDataURL(file);
    } else {
      setEditDishForm((prev) => ({ ...prev, [name]: value }));
    }
  };
  const handleEditDishSubmit = async (e, parentId, idx) => {
    e.preventDefault();
    let photo_url = editDishForm.photo;
    setSuccess('');
    try {
      if (editDishForm.photoFile) {
        const fileExt = editDishForm.photoFile.name.split('.').pop();
        const fileName = `dishes/${parentId}_${Date.now()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from(BUCKET)
          .upload(fileName, editDishForm.photoFile, { upsert: true });
        if (uploadError) throw uploadError;
        const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(fileName);
        photo_url = urlData.publicUrl;
      }
      const { error: updateError } = await supabase
        .from('dishes')
        .update({
          name: editDishForm.name,
          price: editDishForm.price,
          photo_url,
        })
        .eq('id', editDishForm.id);
      if (updateError) throw updateError;
      // Refetch dishes for this parent
      const { data: dishList } = await supabase.from('dishes').select('*').eq('parent_id', parentId);
      setDishes(prev => ({ ...prev, [parentId]: dishList || [] }));
      cancelEditDish();
      setSuccess('Dish updated successfully!');
      setTimeout(() => setSuccess(''), 2000);
    } catch (err) {
      alert('Failed to update dish.');
    }
  };
  const handleDeleteDish = async (parentId, idx) => {
    if (!window.confirm('Delete this dish?')) return;
    setSuccess('');
    try {
      const dishId = dishes[parentId][idx].id;
      await supabase.from('dishes').delete().eq('id', dishId);
      // Refetch dishes for this parent
      const { data: dishList } = await supabase.from('dishes').select('*').eq('parent_id', parentId);
      setDishes(prev => ({ ...prev, [parentId]: dishList || [] }));
      setSuccess('Dish deleted successfully!');
      setTimeout(() => setSuccess(''), 2000);
    } catch (err) {
      alert('Failed to delete dish.');
    }
  };

  const parents = items[selectedSection] || [];

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  // Fetch location suggestions from Nominatim
  const fetchLocationSuggestions = async (query) => {
    if (!query || query.length < 2) {
      setLocationSuggestions([]);
      return;
    }
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&addressdetails=1&limit=5`;
      const response = await fetch(url, { headers: { 'Accept-Language': 'en' } });
      const data = await response.json();
      setLocationSuggestions(data);
    } catch (err) {
      setLocationSuggestions([]);
    }
  };

  // Handle location input change with debounce
  const handleLocationInputChange = (e) => {
    handleParentChange(e); // update parentForm.location
    setShowLocationDropdown(true);
    const value = e.target.value;
    if (locationDebounceTimeout.current) clearTimeout(locationDebounceTimeout.current);
    locationDebounceTimeout.current = setTimeout(() => {
      fetchLocationSuggestions(value);
    }, 400);
  };

  // Handle suggestion selection
  const handleLocationSuggestionClick = (suggestion) => {
    const display = suggestion.display_name;
    setParentForm((prev) => ({ ...prev, location: display }));
    setShowLocationDropdown(false);
    setLocationSuggestions([]);
  };

  // Hide dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (locationInputRef.current && !locationInputRef.current.contains(event.target)) {
        setShowLocationDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Add this handler for location blur
  const handleLocationBlur = async (e) => {
    const location = e.target.value;
    setAutoZipError('');
    if (!location) return;
    setAutoZipLoading(true);
    const zipcode = await getZipcodeFromLocation(location);
    setAutoZipLoading(false);
    if (zipcode) {
      setParentForm(prev => ({ ...prev, zipcode }));
    } else {
      setAutoZipError('Could not auto-detect zipcode for this location.');
    }
  };

  return (
    <div className="admin-bg food-bg-animate">
      <div className="admin-dashboard-container">
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16}}>
          <h2 className="admin-dashboard-title">Admin Dashboard</h2>
          <button
            onClick={handleLogout}
            style={{
              background:'linear-gradient(90deg, #ff4d5a 0%, #ffb347 100%)',
              color:'#fff',
              border:'none',
              borderRadius:10,
              padding:'6px 12px',
              fontWeight:600,
              fontSize:'0.92rem',
              boxShadow:'0 2px 8px rgba(255,77,90,0.10)',
              cursor:'pointer',
              letterSpacing:'0.5px',
              transition:'background 0.2s, box-shadow 0.2s',
              outline:'none',
            }}
          >
            Log Out
          </button>
        </div>
        <button
          style={{
            marginBottom: 24,
            padding: '12px 28px',
            background: '#1a73e8',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            fontWeight: 600,
            fontSize: '1.1rem',
            cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
          }}
          onClick={() => navigate('/admin-orders')}
        >
          Order Management
        </button>
        {loading && <div className="admin-loading-spinner">Loading...</div>}
        {success && <div className="admin-success-message">{success}</div>}
        {error && <div className="admin-error-message">{error}</div>}
        {/* Add Parent Item Form */}
        <form className="admin-dashboard-form" onSubmit={handleParentSubmit} style={{marginBottom: 32}}>
          <div className="form-group">
            <label htmlFor="section">Section</label>
            <select
              name="section"
              value={selectedSection}
              onChange={e => setSelectedSection(e.target.value)}
            >
              {sections.map((s) => (
                <option key={s.key} value={s.key}>{s.label}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="parent-photo">Photo</label>
            <input
              type="file"
              id="parent-photo-input"
              name="photo"
              accept="image/*"
              onChange={handleParentChange}
            />
            {parentForm.photo && <img src={parentForm.photo} alt="preview" className="admin-photo-preview" />}
          </div>
          <div className="form-group">
            <label htmlFor="parent-name">Name</label>
            <input
              type="text"
              name="name"
              value={parentForm.name}
              onChange={handleParentChange}
              required
            />
          </div>
          <div className="form-group" ref={locationInputRef} style={{ position: 'relative' }}>
            <label htmlFor="parent-location">Location</label>
            <input
              type="text"
              name="location"
              value={parentForm.location}
              onChange={handleLocationInputChange}
              onBlur={handleLocationBlur}
              autoComplete="off"
              required
              placeholder="Start typing a city, state, or country..."
              onFocus={() => parentForm.location && setShowLocationDropdown(true)}
            />
            {showLocationDropdown && locationSuggestions.length > 0 && (
              <ul className="location-suggestions-dropdown" style={{
                position: 'absolute',
                zIndex: 10,
                background: '#fff',
                border: '1px solid #eee',
                width: '100%',
                maxHeight: 180,
                overflowY: 'auto',
                listStyle: 'none',
                margin: 0,
                padding: 0,
                boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
              }}>
                {locationSuggestions.map((s, idx) => (
                  <li
                    key={s.place_id}
                    style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid #f3f3f3' }}
                    onClick={() => handleLocationSuggestionClick(s)}
                  >
                    {s.display_name}
                  </li>
                ))}
              </ul>
            )}
          </div>
          {autoZipLoading && <div style={{ color: '#1a73e8', fontSize: '0.95rem', marginTop: 2 }}>Detecting zipcode...</div>}
          {autoZipError && <div style={{ color: '#d73748', fontSize: '0.95rem', marginTop: 2 }}>{autoZipError}</div>}
          <div className="form-group">
            <label htmlFor="parent-zipcode">Zipcode</label>
            <input
              type="text"
              name="zipcode"
              value={parentForm.zipcode}
              onChange={handleParentChange}
              required
              pattern="[0-9]{5,6}"
              title="Please enter a valid 5 or 6 digit zip code"
            />
          </div>
          {parentError && <div className="error-message">{parentError}</div>}
          <button type="submit" className="admin-dashboard-add-btn" disabled={parentLoading}>{parentLoading ? 'Adding...' : 'Add'}</button>
        </form>
        <div className="admin-dashboard-sections">
          {sections.map((s) => (
            <div key={s.key} className="admin-dashboard-section">
              <div className="admin-section-header" style={{display: 'flex', alignItems: 'center', gap: 18, marginBottom: 28}}>
                <h3 style={{margin: 0}}>{s.label}</h3>
                <div className="admin-search-wrapper">
                  <span className="admin-search-icon">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99a1 1 0 001.41-1.41l-4.99-5zm-6 0C8.01 14 6 11.99 6 9.5S8.01 5 10.5 5 15 7.01 15 9.5 12.99 14 10.5 14z" fill="#bbb"/>
                    </svg>
                  </span>
                  <input
                    className="admin-parent-search"
                    type="text"
                    placeholder={`Search ${s.label.toLowerCase()}...`}
                    value={parentSearch[s.key] || ''}
                    onChange={e => setParentSearch(prev => ({ ...prev, [s.key]: e.target.value }))}
                  />
                </div>
              </div>
              <div className="admin-dashboard-items">
                {items[s.key].length === 0 && <span className="admin-dashboard-no-items">No items yet.</span>}
                {items[s.key]
                  .filter(item =>
                    !parentSearch[s.key] || item.name.toLowerCase().includes(parentSearch[s.key].toLowerCase())
                  )
                  .map((item, idx) => (
                    <div
                      key={item.id || idx}
                      className={`admin-dashboard-item-card${selectedParent === String(item.id) ? ' admin-dashboard-item-card-selected' : ''}`}
                      ref={el => parentCardRefs.current[item.id] = el}
                      style={{ cursor: 'pointer', position: 'relative' }}
                    >
                      {editingParentId === item.id ? (
                        <form className="admin-dashboard-edit-form" onSubmit={e => handleEditParentSubmit(e, item)}>
                          <input
                            type="file"
                            ref={editParentPhotoInput}
                            name="photo"
                            accept="image/*"
                            onChange={handleEditParentChange}
                          />
                          {editParentForm.photo && <img src={editParentForm.photo} alt="preview" className="admin-photo-preview" />}
                          <input
                            type="text"
                            name="name"
                            value={editParentForm.name}
                            onChange={handleEditParentChange}
                            required
                            placeholder="Name"
                          />
                          <div className="form-group" ref={locationInputRef} style={{ position: 'relative' }}>
                            <input
                              type="text"
                              name="location"
                              value={editParentForm.location}
                              onChange={(e) => {
                                handleEditParentChange(e);
                                setShowLocationDropdown(true);
                                const value = e.target.value;
                                if (locationDebounceTimeout.current) clearTimeout(locationDebounceTimeout.current);
                                locationDebounceTimeout.current = setTimeout(() => {
                                  fetchLocationSuggestions(value);
                                }, 400);
                              }}
                              autoComplete="off"
                              required
                              placeholder="Start typing a city, state, or country..."
                              onFocus={() => editParentForm.location && setShowLocationDropdown(true)}
                            />
                            {showLocationDropdown && locationSuggestions.length > 0 && (
                              <ul className="location-suggestions-dropdown" style={{
                                position: 'absolute',
                                zIndex: 10,
                                background: '#fff',
                                border: '1px solid #eee',
                                width: '100%',
                                maxHeight: 180,
                                overflowY: 'auto',
                                listStyle: 'none',
                                margin: 0,
                                padding: 0,
                                boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
                              }}>
                                {locationSuggestions.map((s, idx) => (
                                  <li
                                    key={s.place_id}
                                    style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid #f3f3f3' }}
                                    onClick={() => {
                                      setEditParentForm((prev) => ({ ...prev, location: s.display_name }));
                                      setShowLocationDropdown(false);
                                      setLocationSuggestions([]);
                                    }}
                                  >
                                    {s.display_name}
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                          <input
                            type="text"
                            name="zipcode"
                            value={editParentForm.zipcode || ''}
                            onChange={handleEditParentChange}
                            required
                            pattern="[0-9]{5,6}"
                            title="Please enter a valid 5 or 6 digit zip code"
                            placeholder="Zipcode"
                          />
                          <div className="admin-edit-form-actions">
                          <button type="submit" className="edit-btn">Save</button>
                          <button type="button" onClick={cancelEditParent} className="delete-btn">Cancel</button>
                          </div>
                        </form>
                      ) : (
                        <>
                          <img src={item.photo_url} alt={item.name} className="admin-dashboard-item-img" />
                          <div className="admin-dashboard-item-name">{item.name}</div>
                          <div className="admin-dashboard-item-location">{item.location}</div>
                          {item.zipcode && <div className="admin-dashboard-item-zipcode">Zipcode: {item.zipcode}</div>}
                          <div className="admin-dashboard-item-actions">
                            <button className="edit-btn" onClick={e => { e.stopPropagation(); startEditParent(item); }}>Edit</button>
                            <button className="delete-btn" onClick={e => { e.stopPropagation(); handleDeleteParent(item); }}>Delete</button>
                          </div>
                          {/* Menu Card visual cue and trigger */}
                          <div className="admin-menu-card" tabIndex={0} role="button" aria-label="Menu" style={{marginTop: 16, cursor: 'pointer', opacity: 1, pointerEvents: 'auto'}} onClick={() => { setParentModal(item); setSelectedParent(item.id); }}>
                            <img src="https://cdn-icons-png.flaticon.com/512/3595/3595455.png" alt="Menu" className="admin-menu-icon" />
                            <div className="admin-menu-label">Menu</div>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
              </div>
            </div>
          ))}
        </div>
        {/* Menu Modal */}
        <ReactModal
          isOpen={!!parentModal}
          onRequestClose={() => setParentModal(null)}
          className="admin-menu-modal"
          overlayClassName="admin-menu-modal-overlay"
          contentLabel="Parent Details Modal"
        >
          <button className="admin-modal-close-btn" onClick={() => setParentModal(null)} aria-label="Close">Close</button>
          {parentModal && (
            <>
              <h2 style={{textAlign: 'center', marginBottom: 12}}>{parentModal.name} Menu</h2>
              <div style={{textAlign: 'center', color: '#888', marginBottom: 18}}>{parentModal.location}</div>
              <form className="admin-dashboard-form" onSubmit={handleDishSubmit} style={{marginBottom: 24}}>
                <div className="form-group">
                  <label htmlFor="photo">Dish Photo</label>
                  <input
                    type="file"
                    id="dish-photo-input"
                    name="photo"
                    accept="image/*"
                    onChange={handleDishChange}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="name">Dish Name</label>
                  <input
                    type="text"
                    name="name"
                    value={dishForm.name}
                    onChange={handleDishChange}
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="price">Dish Price</label>
                  <input
                    type="number"
                    name="price"
                    value={dishForm.price}
                    onChange={handleDishChange}
                    required
                  />
                </div>
                <button type="submit" className="admin-dashboard-add-btn" disabled={loading}>{loading ? 'Adding...' : 'Add Dish'}</button>
              </form>
              <div className="admin-dashboard-dishes-list">
                <div className="admin-dashboard-dishes-title">Dishes:</div>
                <div className="admin-search-wrapper">
                  <span className="admin-search-icon">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99a1 1 0 001.41-1.41l-4.99-5zm-6 0C8.01 14 6 11.99 6 9.5S8.01 5 10.5 5 15 7.01 15 9.5 12.99 14 10.5 14z" fill="#bbb"/>
                    </svg>
                  </span>
                  <input
                    className="admin-dish-search"
                    type="text"
                    placeholder="Search dishes..."
                    value={dishSearch[parentModal.id] || ''}
                    onChange={e => setDishSearch(prev => ({ ...prev, [parentModal.id]: e.target.value }))}
                  />
                </div>
                <div className="admin-dashboard-dishes-cards">
                  {dishes[parentModal.id]
                    ?.filter(dish =>
                      !dishSearch[parentModal.id] || dish.name.toLowerCase().includes(dishSearch[parentModal.id].toLowerCase())
                    )
                    .map((dish, dIdx) => (
                      <div key={dIdx} className="admin-dashboard-dish-card">
                        {editingDish.parentId === parentModal.id && editingDish.idx === dIdx ? (
                          <form className="admin-dashboard-edit-form" onSubmit={e => handleEditDishSubmit(e, parentModal.id, dIdx)}>
                            <input
                              type="file"
                              ref={editDishPhotoInput}
                              name="photo"
                              accept="image/*"
                              onChange={handleEditDishChange}
                            />
                            {editDishForm.photo && <img src={editDishForm.photo} alt="preview" className="admin-photo-preview" />}
                            <input
                              type="text"
                              name="name"
                              value={editDishForm.name}
                              onChange={handleEditDishChange}
                              required
                              placeholder="Dish Name"
                            />
                            <input
                              type="number"
                              name="price"
                              value={editDishForm.price}
                              onChange={handleEditDishChange}
                              required
                              placeholder="Dish Price"
                            />
                            <div className="admin-edit-form-actions">
                            <button type="submit" className="edit-btn">Save</button>
                            <button type="button" onClick={cancelEditDish} className="delete-btn">Cancel</button>
                            </div>
                          </form>
                        ) : (
                          <>
                            <img src={dish.photo_url} alt={dish.name} className="admin-dashboard-dish-img" />
                            <div className="admin-dashboard-dish-details">
                            <div className="admin-dashboard-dish-name">{dish.name}</div>
                            <div className="admin-dashboard-dish-price">₹{dish.price}</div>
                            <div className="admin-dashboard-dish-actions">
                              <button className="edit-btn" onClick={() => startEditDish(parentModal.id, dIdx, dish)}>Edit</button>
                              <button className="delete-btn" onClick={() => handleDeleteDish(parentModal.id, dIdx)}>Delete</button>
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                </div>
              </div>
            </>
          )}
        </ReactModal>
      </div>
      {/* Floating food SVGs for admin page (same as login/register) */}
      {/* Donut */}
      <svg className="food-float food-float-1" width="48" height="48" viewBox="0 0 48 48" fill="none"><ellipse cx="24" cy="24" rx="20" ry="20" fill="#FDE68A" /><ellipse cx="24" cy="24" rx="14" ry="14" fill="#fff" /><ellipse cx="24" cy="24" rx="8" ry="8" fill="#F59E42" /><circle cx="24" cy="24" r="3" fill="#fff" /><path d="M18 18 Q24 20 30 18" stroke="#F59E42" strokeWidth="2" fill="none" /><path d="M18 30 Q24 28 30 30" stroke="#F59E42" strokeWidth="2" fill="none" /></svg>
      {/* Pizza Slice */}
      <svg className="food-float food-float-2" width="44" height="44" viewBox="0 0 44 44" fill="none"><path d="M22 6 L38 38 Q22 44 6 38 Z" fill="#FFD966" stroke="#B45309" strokeWidth="2" /><ellipse cx="22" cy="32" rx="10" ry="4" fill="#F59E42" /><circle cx="16" cy="28" r="2" fill="#B91C1C" /><circle cx="28" cy="30" r="2" fill="#B91C1C" /><circle cx="22" cy="36" r="1.5" fill="#B91C1C" /></svg>
      {/* Pie */}
      <svg className="food-float food-float-3" width="40" height="40" viewBox="0 0 40 40" fill="none"><ellipse cx="20" cy="28" rx="16" ry="8" fill="#F59E42" /><ellipse cx="20" cy="24" rx="14" ry="6" fill="#FFD966" /><ellipse cx="20" cy="22" rx="10" ry="4" fill="#fff" /><ellipse cx="20" cy="22" rx="4" ry="2" fill="#F59E42" /><path d="M8 28 Q20 34 32 28" stroke="#B45309" strokeWidth="2" fill="none" /></svg>
      {/* Burger */}
      <svg className="food-float food-float-4" width="38" height="38" viewBox="0 0 38 38" fill="none"><ellipse cx="19" cy="13" rx="15" ry="6" fill="#FFD966" stroke="#B45309" strokeWidth="1.5"/><rect x="6" y="18" width="26" height="8" rx="4" fill="#F59E42" stroke="#B45309" strokeWidth="1.5"/><ellipse cx="19" cy="28" rx="12" ry="4" fill="#A3E635" stroke="#15803D" strokeWidth="1.5"/></svg>
      {/* Croissant */}
      <svg className="food-float food-float-5" width="36" height="36" viewBox="0 0 36 36" fill="none"><ellipse cx="18" cy="18" rx="14" ry="7" fill="#FDE68A" stroke="#F59E42" strokeWidth="1.5"/><ellipse cx="18" cy="18" rx="8" ry="3" fill="#F59E42" /></svg>
      {/* Cupcake */}
      <svg className="food-float food-float-6" width="32" height="32" viewBox="0 0 32 32" fill="none"><ellipse cx="16" cy="24" rx="10" ry="4" fill="#FDE68A"/><ellipse cx="16" cy="20" rx="8" ry="3" fill="#fff"/><ellipse cx="16" cy="16" rx="6" ry="2" fill="#F59E42"/><ellipse cx="16" cy="12" rx="4" ry="1.5" fill="#B91C1C"/></svg>
      {/* Repeat and vary for 15 total */}
      <svg className="food-float food-float-7" width="32" height="32" viewBox="0 0 48 48" fill="none"><ellipse cx="24" cy="24" rx="20" ry="20" fill="#FDE68A" /><ellipse cx="24" cy="24" rx="14" ry="14" fill="#fff" /><ellipse cx="24" cy="24" rx="8" ry="8" fill="#F59E42" /><circle cx="24" cy="24" r="3" fill="#fff" /></svg>
      <svg className="food-float food-float-8" width="28" height="28" viewBox="0 0 44 44" fill="none"><path d="M22 6 L38 38 Q22 44 6 38 Z" fill="#FFD966" stroke="#B45309" strokeWidth="2" /></svg>
      <svg className="food-float food-float-9" width="30" height="30" viewBox="0 0 40 40" fill="none"><ellipse cx="20" cy="28" rx="16" ry="8" fill="#F59E42" /></svg>
      <svg className="food-float food-float-10" width="26" height="26" viewBox="0 0 38 38" fill="none"><ellipse cx="19" cy="13" rx="15" ry="6" fill="#FFD966" /></svg>
      <svg className="food-float food-float-11" width="24" height="24" viewBox="0 0 36 36" fill="none"><ellipse cx="18" cy="18" rx="14" ry="7" fill="#FDE68A" /></svg>
      <svg className="food-float food-float-12" width="22" height="22" viewBox="0 0 32 32" fill="none"><ellipse cx="16" cy="24" rx="10" ry="4" fill="#FDE68A"/></svg>
      <svg className="food-float food-float-13" width="36" height="36" viewBox="0 0 48 48" fill="none"><ellipse cx="24" cy="24" rx="20" ry="20" fill="#FDE68A" /></svg>
      <svg className="food-float food-float-14" width="28" height="28" viewBox="0 0 44 44" fill="none"><ellipse cx="22" cy="32" rx="10" ry="4" fill="#F59E42" /></svg>
      <svg className="food-float food-float-15" width="24" height="24" viewBox="0 0 40 40" fill="none"><ellipse cx="20" cy="22" rx="10" ry="4" fill="#fff" /></svg>
    </div>
  );
};

export default AdminDashboard; 