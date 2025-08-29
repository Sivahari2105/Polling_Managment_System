import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: string | Date) {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

export function formatTime(date: string | Date) {
  return new Date(date).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  })
}

export function getCurrentTime() {
  // Return current time in local timezone instead of UTC
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const hours = String(now.getHours()).padStart(2, '0')
  const minutes = String(now.getMinutes()).padStart(2, '0')
  const seconds = String(now.getSeconds()).padStart(2, '0')
  
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`
}

export function getCurrentTimeIST() {
  // Get current time in Indian Standard Time (IST)
  const now = new Date()
  const istOffset = 5.5 * 60 * 60 * 1000 // IST is UTC+5:30
  const istTime = new Date(now.getTime() + istOffset)
  
  const year = istTime.getUTCFullYear()
  const month = String(istTime.getUTCMonth() + 1).padStart(2, '0')
  const day = String(istTime.getUTCDate()).padStart(2, '0')
  const hours = String(istTime.getUTCHours()).padStart(2, '0')
  const minutes = String(istTime.getUTCMinutes()).padStart(2, '0')
  const seconds = String(istTime.getUTCSeconds()).padStart(2, '0')
  
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`
}

export function getCurrentTimeForDisplay() {
  // Get current time formatted for display
  const now = new Date()
  return now.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Kolkata' // Indian Standard Time
  })
}

export function isPollExpired(deadline: string | null) {
  if (!deadline) return false
  
  // Since deadline is now time without timezone (HH:MM:SS), 
  // we need to compare it with current time
  const now = new Date()
  const currentTime = now.toTimeString().split(' ')[0] // HH:MM:SS
  
  return currentTime > deadline
}

export function getTimeRemaining(deadline: string) {
  if (!deadline) return 'No deadline'
  
  // Since deadline is now time without timezone (HH:MM:SS),
  // we need to calculate remaining time based on current time
  const now = new Date()
  const currentTime = now.toTimeString().split(' ')[0] // HH:MM:SS
  
  // Parse times to compare
  const [currentHour, currentMin] = currentTime.split(':').map(Number)
  const [deadlineHour, deadlineMin] = deadline.split(':').map(Number)
  
  let diffHours = deadlineHour - currentHour
  let diffMinutes = deadlineMin - currentMin
  
  // Handle day rollover (if deadline is tomorrow)
  if (diffHours < 0) {
    diffHours += 24
  }
  if (diffMinutes < 0) {
    diffMinutes += 60
    diffHours -= 1
  }
  
  if (diffHours <= 0 && diffMinutes <= 0) return 'Expired'
  
  if (diffHours > 0) {
    return `${diffHours}h ${diffMinutes}m remaining`
  } else {
    return `${diffMinutes}m remaining`
  }
}

// New function to handle created_at as time without timezone
export function formatCreatedAt(createdAt: string | null) {
  if (!createdAt) return 'Unknown'
  
  try {
    // If it's just time (HH:MM:SS), add today's date
    if (createdAt.includes('T') || createdAt.includes(' ')) {
      // It's a full timestamp, format normally
      return new Date(createdAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    } else {
      // It's just time, add today's date
      const today = new Date()
      const timeOnly = new Date(`${today.toISOString().split('T')[0]}T${createdAt}`)
      return timeOnly.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    }
  } catch (error) {
    return 'Invalid date'
  }
}

// New function to handle deadline as time without timezone
export function formatDeadline(deadline: string | null) {
  if (!deadline) return 'No deadline'
  
  try {
    // If it's just time (HH:MM:SS), add today's date and format nicely
    if (deadline.includes(':')) {
      const today = new Date()
      const [hours, minutes] = deadline.split(':')
      const hour = parseInt(hours)
      const ampm = hour >= 12 ? 'PM' : 'AM'
      const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour
      
      // Format as "Jan 15, 2:30 PM" (current date + stored time)
      return `${today.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}, ${displayHour}:${minutes} ${ampm}`
    } else {
      return deadline
    }
  } catch (error) {
    return 'Invalid time'
  }
}

// New function to handle responded_at as time without timezone
export function formatRespondedAt(respondedAt: string | null) {
  if (!respondedAt) return 'Unknown'
  
  try {
    // If it's just time (HH:MM:SS), add today's date and format nicely
    if (respondedAt.includes(':')) {
      const today = new Date()
      const [hours, minutes] = respondedAt.split(':')
      const hour = parseInt(hours)
      const ampm = hour >= 12 ? 'PM' : 'AM'
      const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour
      
      // Format as "Jan 15, 2:30 PM" (current date + stored time)
      return `${today.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}, ${displayHour}:${minutes} ${ampm}`
    } else {
      return respondedAt
    }
  } catch (error) {
    return 'Invalid time'
  }
}

export function exportToExcel(data: any[], filename: string, sheetName: string = 'Sheet1') {
  const XLSX = require('xlsx')
  const ws = XLSX.utils.json_to_sheet(data)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, sheetName)
  XLSX.writeFile(wb, `${filename}.xlsx`)
}

export function exportToExcelWithMultipleSheets(sheets: { name: string, data: any[] }[], filename: string) {
  const XLSX = require('xlsx')
  const wb = XLSX.utils.book_new()
  
  sheets.forEach(sheet => {
    const ws = XLSX.utils.json_to_sheet(sheet.data)
    XLSX.utils.book_append_sheet(wb, ws, sheet.name)
  })
  
  XLSX.writeFile(wb, `${filename}.xlsx`)
}

export function getRoleFromDesignation(designation: string) {
  switch (designation) {
    case 'HOD':
      return 'hod'
    case 'CA':
      return 'faculty'
    case 'CDC':
      return 'cdc'
    default:
      return 'faculty'
  }
}

export function getAccessLevel(role: string) {
  switch (role) {
    case 'student':
      return 1
    case 'faculty':
      return 2
    case 'hod':
      return 3
    case 'cdc':
      return 4
    default:
      return 0
  }
}
