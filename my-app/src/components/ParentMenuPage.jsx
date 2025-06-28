import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import './RestaurantsPage.css';

export default function ParentMenuPage() {
  const { id } = useParams();
  const [parent, setParent] = useState(null);
  const [dishes, setDishes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError('');
      try {
        const { data: parentData, error: parentError } = await supabase
          .from('admin_items')
          .select('*')
          .eq('id', id)
          .single();
        if (parentError) throw parentError;
        setParent(parentData);
        const { data: dishData, error: dishError } = await supabase
          .from('dishes')
          .select('*')
          .eq('parent_id', id);
        if (dishError) throw dishError;
        setDishes(dishData || []);
      } catch (err) {
        setError('Failed to load menu.');
      }
      setLoading(false);
    };
    fetchData();
  }, [id]);

  if (loading) return <div className="category-page-container">Loading...</div>;
  if (error) return <div className="category-page-container" style={{color:'#d73748'}}>{error}</div>;
  if (!parent) return <div className="category-page-container">Not found.</div>;

  return (
    <div className="category-page-container">
      <div style={{display:'flex', alignItems:'center', gap:24, marginBottom:32}}>
        <img src={parent.photo_url} alt={parent.name} style={{width:80, height:80, borderRadius:12, objectFit:'cover', background:'#fafbfc'}} />
        <div>
          <h2 style={{margin:0, color:'#ff4d5a'}}>{parent.name}</h2>
          <div style={{color:'#666', fontSize:'1.08rem', marginTop:4}}>{parent.location}</div>
        </div>
      </div>
      <h3 style={{marginBottom:18, color:'#222'}}>Menu</h3>
      {dishes.length === 0 ? (
        <div style={{color:'#888', fontSize:'1.1rem'}}>No dishes yet.</div>
      ) : (
        <div className="category-cards-grid">
          {dishes.map((dish, idx) => (
            <div className="category-card-preview" key={idx}>
              <img src={dish.photo_url} alt={dish.name} />
              <span>{dish.name}</span>
              <span style={{color:'#1a73e8', fontWeight:600, fontSize:'1.05rem', marginTop:4}}>₹{dish.price}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
} 