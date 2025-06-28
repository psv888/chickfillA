import React, { useState } from 'react';

function RestaurantCard({ restaurant, onCardClick }) {
    const images = restaurant.images && restaurant.images.length > 0 ? restaurant.images : [restaurant.photo_url];
    const [currentImg, setCurrentImg] = useState(0);
    const hasCarousel = images.length > 1;
    const goPrev = (e) => { e.stopPropagation(); setCurrentImg((currentImg - 1 + images.length) % images.length); };
    const goNext = (e) => { e.stopPropagation(); setCurrentImg((currentImg + 1) % images.length); };
    return (
      <div className="category-card-preview" onClick={onCardClick} style={{cursor:'pointer'}}>
        <div style={{position:'relative', width:'100%'}}>
          <img className="category-card-img-top" src={images[currentImg]} alt={restaurant.name} />
          <div className="category-card-img-overlay">
            <div className="category-card-img-overlay-content">
              <div className="category-card-img-overlay-top">
                <div className="category-card-delivery">
                  <span style={{fontSize: '1.1em', color: '#3ec16c'}}>⏱️</span>
                  <span>{restaurant.deliveryTime || '32 mins'} • {restaurant.distance || '5 km'}</span>
                </div>
              </div>
              {hasCarousel && (
                <div className="category-card-img-overlay-bottom">
                  <button onClick={goPrev} style={{background:'rgba(255,255,255,0.8)',border:'none',borderRadius:'50%',width:24,height:24,marginRight:8,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontSize:16}}>&lt;</button>
                  <div className="category-card-carousel-dots">
                    {images.map((_, i) => (
                      <span key={i} className={"category-card-carousel-dot" + (i === currentImg ? ' active' : '')}></span>
                    ))}
                  </div>
                  <button onClick={goNext} style={{background:'rgba(255,255,255,0.8)',border:'none',borderRadius:'50%',width:24,height:24,marginLeft:8,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontSize:16}}>&gt;</button>
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="category-card-info">
          <div className="category-card-title-row">
            <div className="category-card-title">{restaurant.name}</div>
            <div className="category-card-rating-badge">{restaurant.rating || '3.9'}★</div>
          </div>
          {restaurant.description ? (
            <div className="category-card-description">{restaurant.description}</div>
          ) : (
            (restaurant.address || restaurant.location) && (
              <div className="category-card-description">
                {restaurant.address || restaurant.location}
              </div>
            )
          )}
        </div>
      </div>
    );
  }

  export default RestaurantCard; 