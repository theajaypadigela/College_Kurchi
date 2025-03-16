import React from "react";

function Input(props) {
    return  <input 
    id="rankInput"
    type="number"
    placeholder='Enter your Rank'
    value={props.Rank}
    onChange={props.onChange}
    required
    style={{ width: '85%' }} 
    min={1}
  />;
    }

export default Input;