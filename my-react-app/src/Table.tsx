import * as React from 'react';
import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TablePagination from '@mui/material/TablePagination';
import TableRow from '@mui/material/TableRow';

type Column = {
  id: 'sNo' | 'college' | 'course' | 'lastRank';
  label: string;
  minWidth?: number;
  align?: 'right' | 'left' | 'inherit' | 'center';
  format?: (value: number | string) => string;
};

const columns: Column[] = [
  { id: 'sNo', label: 'S.NO', minWidth: 80 },
  { id: 'college', label: 'College', minWidth: 200 },
  { id: 'course', label: 'Course', minWidth: 200 },
  {
    id: 'lastRank',
    label: 'Last Rank',
    minWidth: 120,
    align: 'right',
  }
];

export type Data = {
  sNo: number;
  college: string;
  course: string;
  lastRank: number;
};

export function createData(
  sNo: number,
  college: string,
  course: string,
  lastRank: number,
): Data {
  return { sNo, college, course, lastRank };
}

interface StickyHeadTableProps {
  rows: Data[];
}

export default function StickyHeadTable({ rows }: StickyHeadTableProps) {
  const [page, setPage] = React.useState(0);
  const [rowsPerPage, setRowsPerPage] = React.useState(10);

  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(+event.target.value);
    setPage(0);
  };


  return (
    <div className="table" style={{ width: '100%' }}>
      <Paper sx={{ width: '100%', overflow: 'auto' }}>
        <TableContainer sx={{ maxHeight: 440 }}>
          <Table stickyHeader aria-label="sticky table">
            <TableHead>
              <TableRow>
                {columns.map((column) => (
                  <TableCell
                    key={column.id}
                    align={column.align}
                    style={{ minWidth: column.minWidth }}
                  >
                    {column.label}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {rows
                .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                .map((row) => {
                  return (
                    <TableRow hover role="checkbox" tabIndex={-1} key={row.sNo}>
                      {columns.map((column) => {
                        const value = row[column.id];
                        return (
                          <TableCell key={column.id} align={column.align}>
                            {column.format && typeof value === 'number'
                              ? column.format(value)
                              : value}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  );
                })}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          rowsPerPageOptions={[10, 25, 100]}
          component="div"
          count={rows.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
        />
      </Paper>
    </div>
  );
}