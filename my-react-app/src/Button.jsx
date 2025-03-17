import React from "react";

function Button(props) {
  const buttonStyle = props.isSelected ? 
    { 
      backgroundColor: '#2ecc71', 
      border: '3px solid #fff',
      boxShadow: '0 0 12px rgba(46, 204, 113, 0.7)',
      transform: 'scale(1.05)',
      position: 'relative'
    } : {};
  
  return <button 
    className={props.className} 
    onClick={() => props.onClick(props.group)}
    style={buttonStyle}
  >
    {props.group}
    <p style={{fontSize: "10px"}}>{props.full}</p>
    {props.isSelected && 
      <div style={{
        position: 'absolute',
        top: '5px',
        right: '5px',
        backgroundColor: '#fff',
        color: '#2ecc71',
        borderRadius: '50%',
        width: '20px',
        height: '20px',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        fontWeight: 'bold',
        fontSize: '14px'
      }}>
        ✓
      </div>
    }
  </button>;
}

export default Button;