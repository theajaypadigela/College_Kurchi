import React from "react";
import Button from "./Button";

function Branch(props) {
  function handleClick(group) {
    props.onChange(group);
  }

  // Helper function to check if a branch is selected
  function isSelected(group) {
    return props.selectedBranches && props.selectedBranches.includes(group);
  }

  return (
    <div className="branch">
      <div>
        <Button onClick={handleClick} className="group" group="CIV" full="Civil Engineering" isSelected={isSelected("CIV")} />
        <Button onClick={handleClick} className="group" group="MEC" full="Mechanical Engineering" isSelected={isSelected("MEC")} />
        <Button onClick={handleClick} className="group" group="EEE" full="Electrical &amp; Electronics Engineering" isSelected={isSelected("EEE")} />
        <Button onClick={handleClick} className="group" group="ECE" full="Electronics &amp; Communication Engineering" isSelected={isSelected("ECE")} />
      </div>
      <div>
        <Button onClick={handleClick} className="group" group="CSE" full="Computer Science Engineering" isSelected={isSelected("CSE")} />
        <Button onClick={handleClick} className="group" group="INF" full="Information Technology" isSelected={isSelected("INF")} />
        <Button onClick={handleClick} className="group" group="CHE" full="Chemical Engineering" isSelected={isSelected("CHE")} />
        <Button onClick={handleClick} className="group" group="BTE" full="Biotechnology" isSelected={isSelected("BTE")} />
      </div>
      <div>
        <Button onClick={handleClick} className="group" group="AGR" full="Agricultural Engineering" isSelected={isSelected("AGR")} />
        <Button onClick={handleClick} className="group" group="AER" full="Aeronautical Engineering" isSelected={isSelected("AER")} />
        <Button onClick={handleClick} className="group" group="AUT" full="Automobile Engineering" isSelected={isSelected("AUT")} />
        <Button onClick={handleClick} className="group" group="BME" full="Biomedical Engineering" isSelected={isSelected("BME")} />
      </div>
      <div>
        <Button onClick={handleClick} className="group" group="FDT" full="Food Technology" isSelected={isSelected("FDT")} />
        <Button onClick={handleClick} className="group" group="MIN" full="Mining Engineering" isSelected={isSelected("MIN")} />
        <Button onClick={handleClick} className="group" group="MCT" full="Mechatronics Engineering" isSelected={isSelected("MCT")} />
        <Button onClick={handleClick} className="group" group="PCT" full="Petroleum Engineering" isSelected={isSelected("PCT")} />
      </div>
      <div>
        <Button onClick={handleClick} className="group" group="MMT" full="Metallurgical &amp; Materials Engineering" isSelected={isSelected("MMT")} />
        <Button onClick={handleClick} className="group" group="MIE" full="Marine Engineering" isSelected={isSelected("MIE")} />
        <Button onClick={handleClick} className="group" group="TEX" full="Textile Engineering" isSelected={isSelected("TEX")} />
        <Button onClick={handleClick} className="group" group="IEE" full="Instrumentation Engineering" isSelected={isSelected("IEE")} />
      </div>
      <div>
        <Button onClick={handleClick} className="group" group="IST" full="Instrumentation &amp; Control Engineering" isSelected={isSelected("IST")} />
        <Button onClick={handleClick} className="group" group="AI" full="Artificial Intelligence" isSelected={isSelected("AI")} />
        <Button onClick={handleClick} className="group" group="AID" full="AI &amp; Data Science" isSelected={isSelected("AID")} />
        <Button onClick={handleClick} className="group" group="AIM" full="AI &amp; Machine Learning" isSelected={isSelected("AIM")} />
      </div>
      <div>
        <Button onClick={handleClick} className="group" group="CSB" full="Computer Science &amp; Business Systems" isSelected={isSelected("CSB")} />
        <Button onClick={handleClick} className="group" group="CSC" full="Computer Science (Cyber Security)" isSelected={isSelected("CSC")} />
        <Button onClick={handleClick} className="group" group="CSD" full="Computer Science (Data Science)" isSelected={isSelected("CSD")} />
        <Button onClick={handleClick} className="group" group="CSO" full="Computer Science (IoT)" isSelected={isSelected("CSO")} />
      </div>
      <div>
        <Button onClick={handleClick} className="group" group="CSS" full="Computer Science &amp; Systems Engineering" isSelected={isSelected("CSS")} />
        <Button onClick={handleClick} className="group" group="CST" full="Computer Science &amp; Technology" isSelected={isSelected("CST")} />
        <Button onClick={handleClick} className="group" group="CSW" full="Computer Science (AI &amp; ML)" isSelected={isSelected("CSW")} />
        <Button onClick={handleClick} className="group" group="CSY" full="Computer Science (Networks)" isSelected={isSelected("CSY")} />
      </div>
      <div>
        <Button onClick={handleClick} className="group" group="CSZ" full="Computer Science (Software Engineering)" isSelected={isSelected("CSZ")} />
        <Button onClick={handleClick} className="group" group="EBM" full="Electronics &amp; Computer Engineering" isSelected={isSelected("EBM")} />
        <Button onClick={handleClick} className="group" group="ECD" full="Electronics &amp; Communication (AI &amp; ML)" isSelected={isSelected("ECD")} />
        <Button onClick={handleClick} className="group" group="ECM" full="Electronics &amp; Computer Engineering" isSelected={isSelected("ECM")} />
      </div>
      <div>
        <Button onClick={handleClick} className="group" group="ECI" full="Electronics &amp; Communication (IoT)" isSelected={isSelected("ECI")} />
        <Button onClick={handleClick} className="group" group="EIE" full="Electronics &amp; Instrumentation Engineering" isSelected={isSelected("EIE")} />
        <Button onClick={handleClick} className="group" group="ELC" full="Electronics Engineering" isSelected={isSelected("ELC")} />
        <Button onClick={handleClick} className="group" group="ROB" full="Robotics Engineering" isSelected={isSelected("ROB")} />
      </div>
      <div>
        <Button onClick={handleClick} className="group" group="ENV" full="Environmental Engineering" isSelected={isSelected("ENV")} />
        <Button onClick={handleClick} className="group" group="IND" full="Industrial Engineering" isSelected={isSelected("IND")} />
        <Button onClick={handleClick} className="group" group="PEE" full="Power Electronics Engineering" isSelected={isSelected("PEE")} />
        <Button onClick={handleClick} className="group" group="CSEC" full="Control Systems Engineering" isSelected={isSelected("CSEC")} />
      </div>
      <div>
        <Button onClick={handleClick} className="group" group="EMB" full="Embedded Systems Engineering" isSelected={isSelected("EMB")} />
        <Button onClick={handleClick} className="group" group="VLSI" full="VLSI Design Engineering" isSelected={isSelected("VLSI")} />
      </div>
    </div>
  );
}

export default Branch;