import { useState, useEffect } from "react";
import api from "../api";

function OrgUnitsListing() {
  const [orgUnits, setOrgUnits] = useState([]);

  const fetchOrgUnits = async () => {
    try {
      const response = await api.get('/org-units/');
      setOrgUnits(response.data);
    } catch (error) {
      if (error.response) {
        // Server responded with a status other than 2xx
        console.error("Failed to fetch organization units:", error.response.status, error.response.data);
      } else {
        // Network error or other
        console.error("Failed to fetch organization units:", error.message);
      }
    }
  };

  useEffect(() => {
    fetchOrgUnits();
  }, []);

  return (
    <div className="org-units-listing">
      {orgUnits.map((orgUnit) => (
        <div
          key={orgUnit.id}
          className="org-unit-item"
          
        >
          <h3>{orgUnit.name}</h3>
          <p>{orgUnit.description}</p>
        </div>
      ))}
    </div>
  );
}

export default OrgUnitsListing;