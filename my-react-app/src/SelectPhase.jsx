import React from "react";
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormControl from '@mui/material/FormControl';

function SelectPhase(props) {
    return <FormControl style={{ width: '100%' }}>
    <RadioGroup
      aria-labelledby="demo-radio-buttons-group-label"
      value={props.phase}
      name="radio-buttons-group"
      onChange={props.onChange}
      style={{ display: 'flex', flexDirection: 'row', justifyContent: 'center', width: '100%', gap: '15px' }}
    >
      <FormControlLabel value="first" control={<Radio />} label="First Phase" />
      <FormControlLabel value="second" control={<Radio />} label="Second Phase" />
      <FormControlLabel value="third" control={<Radio />} label="Thrid phase" />
      <FormControlLabel value="final" control={<Radio />} label="Final Phase" />
    </RadioGroup>
  </FormControl>;
}
export default SelectPhase;