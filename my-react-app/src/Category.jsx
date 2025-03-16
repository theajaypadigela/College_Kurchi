import React from "react";
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import Select from '@mui/material/Select';

function Category(props) {
  const category = ['GENERAL', 'OC', 'BC-A', 'BC-B', 'BC-C', 'BC-D', 'BC-E', 'EWS', 'SC', 'ST'];
    return                 <FormControl required sx={{ m: 1, minWidth: 300 }}>
                          <InputLabel id="category-select-label">Category</InputLabel>
                          <Select
                            labelId="category-select-label"
                            id="category-select"
                            value={props.category}
                            label="Category"
                            onChange={props.onChange}
                          >
                            <MenuItem value={category[0]}>General</MenuItem>
                            <MenuItem value={category[1]}>OC</MenuItem>
                            <MenuItem value={category[2]}>BC-A</MenuItem>
                            <MenuItem value={category[3]}>BC-B</MenuItem>
                            <MenuItem value={category[4]}>BC-C</MenuItem>
                            <MenuItem value={category[5]}>BC-D</MenuItem>
                            <MenuItem value={category[6]}>BC-E</MenuItem>
                            <MenuItem value={category[7]}>EWS</MenuItem>
                            <MenuItem value={category[8]}>SC</MenuItem>
                            <MenuItem value={category[9]}>ST</MenuItem>
                          </Select>
                        </FormControl>;
    }

    export default Category;