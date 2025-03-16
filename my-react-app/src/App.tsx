import React, { useState } from 'react';
import Input from './Input';
import Category from './Category';
import Gender from './Gender';
import SelectPhase from './SelectPhase';
import Branchs from './Branch';
import StickyHeadTable, { Data, createData } from './Table';
import firstPhaseData from './firstphase';
import secondPhaseData from './secondphase';
import finalPhaseData from './finalphase';

interface CollegeData {
  "Institution Name": string;
  "Branch": string;
  "Branch Name"?: string;
  [key: string]: any;
}

function App() {
  const [rank, setRank] = useState('');
  const [category, setCategory] = useState('');
  const [gender, setGender] = useState('');
  const [phase, setPhase] = useState('first');
  const [phaseSelected, setPhaseSelected] = useState(false);
  const [isFlipped, setIsFlipped] = useState(false);
  const [branch, setBranch] = useState<string[]>([]);
  const [phaseData, setPhaseData] = useState<CollegeData[]>([]);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [rows, setRows] = useState<Data[]>([]);

  function loadPhaseData(selectedPhase: string): void {
    let data;
    switch (selectedPhase) {
      case 'first':
        data = firstPhaseData;
        break;
      case 'second':
        data = secondPhaseData;
        break;
      case 'final':
        data = finalPhaseData;
        break;
      default:
        data = firstPhaseData;
    }
    setPhaseData(data);
  }

  function handleRankChange(event: React.ChangeEvent<HTMLInputElement>): void {
    setRank(event.target.value);
  }

  function handleCategoryChange(event: React.ChangeEvent<HTMLInputElement>): void {
    setCategory(event.target.value);
  }

  function handleGenderChange(event: React.ChangeEvent<HTMLInputElement>): void {
    setGender(event.target.value);
  }

  function handlePhaseChange(event: React.ChangeEvent<HTMLInputElement>): void {
    const selectedPhase = event.target.value;
    setPhase(selectedPhase);
    setPhaseSelected(true);
    loadPhaseData(selectedPhase);
  }

  function validateForm(): boolean {
    if (!rank || rank.trim() === '') {
      setErrorMessage('Please enter your rank');
      return false;
    }
    const rankNum = parseInt(rank, 10);
    if (isNaN(rankNum) || rankNum < 1) {
      setErrorMessage('Please enter a valid rank');
      return false;
    }
    if (!category || category.trim() === '') {
      setErrorMessage('Please select your category');
      return false;
    }
    if (!gender || gender.trim() === '') {
      setErrorMessage('Please select your gender');
      return false;
    }
    if (!phaseSelected) {
      setErrorMessage('Please select a phase');
      return false;
    }
    if (branch.length === 0) {
      setErrorMessage('Please select at least one branch preference');
      return false;
    }
    if (!phaseData || !Array.isArray(phaseData) || phaseData.length === 0) {
      setErrorMessage('Phase data not loaded. Please try selecting a phase again.');
      return false;
    }
    setErrorMessage('');
    return true;
  }

  function handleSubmit() {
    if (!validateForm()) {
      return;
    }
    setIsFlipped(true);
    const rankNum = parseInt(rank);
    if (!isNaN(rankNum) && Array.isArray(phaseData)) {
      const selectedGender = gender === 'Male' ? 'Boys' : 'Girls';
      const rankField = `${category} ${selectedGender}`;
      const branchMappings = {
        'INF': ['IT', 'INF', 'INFORMATION TECHNOLOGY', 'INFORMATION'],
        'CSE': ['CSE', 'CS', 'COMPUTER SCIENCE', 'COMPUTER', 'COMPUTING'],
        'MEC': ['MEC', 'MECHANICAL'],
        'CIV': ['CIV', 'CIVIL'],
        'EEE': ['EEE', 'ELECTRICAL', 'ELECTRONICS AND ELECTRICAL'],
        'ECE': ['ECE', 'ELECTRONIC', 'COMMUNICATION', 'ELECTRONICS AND COMMUNICATION'],
        'CSM': ['CSM'],
        'CSO': ['CSO'],
        'CSC': ['CSC'],
        'CSD': ['CSD'],
        'CSI': ['CSI'],
        'CSB': ['CSB'],
        'AID': ['AID', 'ARTIFICIAL INTELLIGENCE AND DATA SCIENCE'],
        'AIM': ['AIM', 'ARTIFICIAL INTELLIGENCE AND MACHINE LEARNING']
      };
      const filteredColleges = phaseData.filter(college => {
        if (!college) return false;
        let branchMatch = false;
        if (branch.length === 0) {
          branchMatch = true;
        } else {
          const collegeBranch = college["Branch"] || '';
          const collegeBranchName = college["Branch Name"] || '';
          branchMatch = branch.includes(collegeBranch);
        }
        const collegeRank = college[rankField];
        const rankMatch = collegeRank !== null && collegeRank !== undefined && rankNum <= collegeRank;
        return branchMatch && rankMatch;
      });
      const sortedColleges = [...filteredColleges].sort((a, b) => {
        const rankA = a[rankField] || Number.MAX_SAFE_INTEGER;
        const rankB = b[rankField] || Number.MAX_SAFE_INTEGER;
        return rankA - rankB;
      });
      const tableData = sortedColleges.map((college, index) => {
        let branchName = college["Branch Name"] || "";
        let collegeName = college["Institute Name"] || college["Institution Name"] || "Unknown College";
        if (typeof collegeName === 'string') {
          collegeName = collegeName.trim();
        }
        if (typeof branchName === 'string') {
          branchName = branchName.trim();
        }
        return createData(index + 1, collegeName, branchName, college[rankField] || 0);
      });
      if (tableData.length > 0) {
        setRows(tableData);
      } else {
        setRows([createData(1, "No colleges found matching your criteria", "", 0)]);
      }
    } else {
      setRows([createData(1, "Please enter a valid rank and select phase", "", 0)]);
    }
  }

  function handleFlipBack() {
    setIsFlipped(false);
  }

  function addBranch(group: string): void {
    setBranch(prev => {
      if (prev.includes(group)) {
        return prev.filter(item => item !== group);
      } else {
        return [...prev, group];
      }
    });
  }

  return (
    <div>
      <nav className="navbar">
        College Kurchi
      </nav>
      
      <div className="content-container">
        <div className={`card ${isFlipped ? 'flipped' : ''}`}>
          { !isFlipped ? (
            <div className="front">
              <div style={{ display: 'flex', alignItems: 'center', width: '80%', marginBottom: '15px' }}>
                <label htmlFor="rankInput" style={{ marginRight: '10px', fontWeight: 'bold', minWidth: '50px' }}>Rank:</label>
                <Input Rank={rank} onChange={handleRankChange}/>
              </div>
              <div>
                <Category category={category} onChange={handleCategoryChange}/>
                <Gender onChange={handleGenderChange} value={gender} />
              </div>
              <div style={{ width: '100%', alignSelf: 'stretch', padding: '0', marginTop: 10 }}>
                <SelectPhase onChange={handlePhaseChange} value={phase} />
              </div>
              {/* <div style={{margin: 15 }}></div> */}
              <div style={{display:'flex', justifyContent:'center', alignItems:'center', backgroundColor: 'lightgreen', padding:'10px', margin:'15px'}}>
                <label htmlFor=""> select your Preferd branch </label>
              </div>
              <Branchs onChange={addBranch} selectedBranches={branch} />
              {errorMessage && (
                <div style={{ color: 'red', backgroundColor: '#ffeeee', padding: '10px', borderRadius: '5px', margin: '10px 0', textAlign: 'center' }}>
                  {errorMessage}
                </div>
              )}
              <button onClick={handleSubmit}>submit</button>
            </div>
          ) : (
            <div className="back">
              <div style={{textAlign: 'center'}}>
                <h2>Available Colleges Based on Your Rank</h2>
                <StickyHeadTable rows={rows} />
                <button onClick={handleFlipBack}>Flip Back</button>
              </div>
            </div>
          )}
        </div>
        <div className="bottom-heading" style={{ margin: "20px" }}></div>
      </div>
    </div>
  );
}

export default App;