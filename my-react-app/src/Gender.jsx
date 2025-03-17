import React from 'react';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import Select from '@mui/material/Select';

function Gender(props) {
    return <FormControl required sx={{ m: 1, minWidth: 300 }}>
    <InputLabel id="gender-select-label">Gender</InputLabel>
    <Select
      labelId="gender-select-label"
      id="gender-select"
      value={props.value}
      label="Gender"
      onChange={props.onChange}
    >
      {/* <MenuItem value=""></MenuItem> */}
      <MenuItem value="Male">Male</MenuItem>
      <MenuItem value="Female">Female</MenuItem>
      {/* <MenuItem value="Other">Other</MenuItem> */}
    </Select>
  </FormControl>;
}

export default Gender;