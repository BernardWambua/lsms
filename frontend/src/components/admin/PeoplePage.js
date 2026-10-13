import { useState } from 'react';
import { Box, Tab, Tabs, Typography } from '@mui/material';
import UsersTable from '../common/UsersTable';
import Invitations from '../Invitations';

export default function PeoplePage() {
  const [tab, setTab] = useState('people');
  return (
    <Box>
      <Typography variant="h5">People</Typography>
      <Typography color="text.secondary" mb={2}>Everyone in your organisation, and the invitations you've sent.</Typography>
      <Tabs value={tab} onChange={(e, value) => setTab(value)} sx={{ mb: 2 }}>
        <Tab value="people" label="People" />
        <Tab value="invitations" label="Invitations" />
      </Tabs>
      {tab === 'people' ? <UsersTable canManage /> : <Invitations />}
    </Box>
  );
}
