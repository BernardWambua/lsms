import React from 'react';
import PropTypes from 'prop-types';
import api from '../api';
import { useState } from 'react';

function OrgUnits({ orgUnits, onOrgUnitClick }) {
    const [searchTerm, setSearchTerm] = useState('');

    const filteredOrgUnits = orgUnits.filter((orgUnit) =>
        orgUnit.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

  return (
    <div className="org-units">
      {filteredOrgUnits.map((orgUnit) => (
        <div
          key={orgUnit.id}
          className="org-unit"
          onClick={() => onOrgUnitClick(orgUnit)}
        >
          <h3>{orgUnit.name}</h3>
          <p>{orgUnit.description}</p>
        </div>
      ))}
    </div>
  );
}