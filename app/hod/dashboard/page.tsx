'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { UserCheck, LogOut, BarChart3, Users, Download, Eye, TrendingUp, Building, Plus, Trash2, RefreshCw } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { formatDate, formatCreatedAt, exportToExcel, exportToExcelWithMultipleSheets, getCurrentTime, isPollExpired, formatDeadline, formatRespondedAt } from '@/lib/utils'
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

interface Student {
  reg_no: string
  name: string
  email: string
  department: string
  section: string
}

interface Poll {
  id: number
  title: string
  created_at: string
  staff_name: string
  staff_id?: number
  class_name: string
  deadline?: string | null
  poll_type?: 'text' | 'options'
  options?: string[]
  poll_category?: 'General Poll' | 'Hackathon' | 'G-Form Poll'
  classStudents?: Student[]
}

interface PollResponse {
  id: number
  poll_id: number
  student_reg_no: string
  response: string
  responded_at: string
  student_name: string
  option_index?: number | null
}

interface SectionStats {
  section: string
  totalStudents: number
  respondedStudents: number
  responseRate: number
}

export default function HODDashboard() {
  const [hodData, setHodData] = useState<any>(null)
  const [students, setStudents] = useState<Student[]>([])
  const [polls, setPolls] = useState<Poll[]>([])
  const [responses, setResponses] = useState<PollResponse[]>([])
  const [sectionStats, setSectionStats] = useState<SectionStats[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRealtimeUpdating, setIsRealtimeUpdating] = useState(false)
  const [loadingProgress, setLoadingProgress] = useState<string>('Initializing...')
  const [activeTab, setActiveTab] = useState<'overview' | 'students' | 'polls' | 'analytics'>('overview')
  const [selectedPoll, setSelectedPoll] = useState<Poll | null>(null)
  const [selectedSection, setSelectedSection] = useState<string>('all')
  const [showCreatePoll, setShowCreatePoll] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null)
  const router = useRouter()

  useEffect(() => {
    const storedData = localStorage.getItem('hodData')
    if (!storedData) {
      router.push('/hod/login')
      return
    }

    const data = JSON.parse(storedData)
    setHodData(data)
    setLastRefreshed(new Date()) // Set initial refresh time
    fetchDepartmentData(data)

    // Add keyboard shortcut for refresh (Ctrl+R or Cmd+R)
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'r') {
        e.preventDefault()
        if (data && !isRefreshing) {
          handleRefresh()
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)

    // Set up real-time subscriptions with debouncing
    const setupRealtimeSubscriptions = () => {
      let refreshTimeout: NodeJS.Timeout | null = null
      
      const debouncedRefresh = () => {
        if (refreshTimeout) clearTimeout(refreshTimeout)
        refreshTimeout = setTimeout(() => {
          setIsRealtimeUpdating(true)
          fetchDepartmentData(data)
          setTimeout(() => setIsRealtimeUpdating(false), 2000)
        }, 1000) // Wait 1 second before refreshing to batch multiple changes
      }

      // Subscribe to poll_responses changes
      const pollResponsesSubscription = supabase
        .channel('poll_responses_changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'poll_responses'
          },
          debouncedRefresh
        )
        .subscribe()

      // Subscribe to polls changes
      const pollsSubscription = supabase
        .channel('polls_changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'polls'
          },
          debouncedRefresh
        )
        .subscribe()

      // Subscribe to students changes
      const studentsSubscription = supabase
        .channel('students_changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'students'
          },
          debouncedRefresh
        )
        .subscribe()

      // Return cleanup function
      return () => {
        if (refreshTimeout) clearTimeout(refreshTimeout)
        pollResponsesSubscription.unsubscribe()
        pollsSubscription.unsubscribe()
        studentsSubscription.unsubscribe()
      }
    }

    const cleanup = setupRealtimeSubscriptions()

    // Cleanup on unmount
    return () => {
      cleanup()
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [router, isRefreshing])

  // Effect to monitor selectedPoll changes for debugging
  useEffect(() => {
    if (selectedPoll) {
      console.log('selectedPoll changed to:', selectedPoll.id, selectedPoll.title, selectedPoll.class_name)
    }
  }, [selectedPoll])

  const fetchDepartmentData = useCallback(async (hod: any) => {
    try {
      setLoadingProgress('Loading students...')
      
      // Fetch all students in the department in one query
      const { data: studentsData, error: studentsError } = await supabase
        .from('students')
        .select('*')
        .eq('department', hod.department)
        .order('section', { ascending: true })
        .order('name', { ascending: true })
      
      if (studentsError) throw studentsError
      
      setStudents(studentsData || [])
      setLoadingProgress('Loading polls...')

      // Fetch all polls in the department
      const { data: classesData, error: classesError } = await supabase
        .from('classes')
        .select('id')
        .eq('department', hod.department)

      if (classesError) throw classesError

      const classIds = classesData.map(c => c.id)
      
      const { data: pollsData, error: pollsError } = await supabase
        .from('polls')
        .select(`
          *,
          staffs(name, id),
          classes(department, section)
        `)
        .in('class_id', classIds)
        .order('created_at', { ascending: false })

      if (pollsError) throw pollsError

      const formattedPolls = pollsData.map((poll: any) => ({
        id: poll.id,
        title: poll.title,
        created_at: poll.created_at,
        staff_name: poll.staffs?.name || 'Unknown',
        staff_id: poll.staffs?.id || null,
        class_name: `${poll.classes?.department} ${poll.classes?.section}`,
        deadline: poll.deadline,
        options: poll.options || [],
        poll_type: poll.poll_type || 'options',
        poll_category: poll.poll_category || 'General Poll'
      }))

      setPolls(formattedPolls)
      setLoadingProgress('Calculating statistics...')

      // Calculate section statistics
      await calculateSectionStats(studentsData || [], formattedPolls)
    } catch (error) {
      console.error('Error fetching department data:', error)
      toast.error('Failed to fetch department data')
    } finally {
      setIsLoading(false)
    }
  }, [])

  const handleRefresh = async () => {
    if (!hodData) return
    
    setIsRefreshing(true)
    try {
      // Refresh all department data
      await fetchDepartmentData(hodData)
      
      setLastRefreshed(new Date())
      toast.success('Data refreshed successfully!')
    } catch (error) {
      console.error('Error refreshing data:', error)
      toast.error('Failed to refresh data')
    } finally {
      setIsRefreshing(false)
    }
  }

  const calculateSectionStats = async (students: Student[], polls: Poll[]) => {
    const sections = Array.from(new Set(students.map(s => s.section)))
    const stats: SectionStats[] = []

    // Get all responses for all polls in one query instead of multiple queries
    if (polls.length > 0) {
      const pollIds = polls.map(p => p.id)
      const { data: allResponses } = await supabase
        .from('poll_responses')
        .select('poll_id, student_reg_no')
        .in('poll_id', pollIds)

      // Calculate response rates for each section
      for (const section of sections) {
        const sectionStudents = students.filter(s => s.section === section)
        const totalStudents = sectionStudents.length
        const sectionStudentRegNos = sectionStudents.map(s => s.reg_no)
        
        // Count responses for this section from the cached data
        let totalResponses = 0
        if (allResponses) {
          totalResponses = allResponses.filter(r => 
            sectionStudentRegNos.includes(r.student_reg_no)
          ).length
        }
        
        // Calculate response rate as percentage of students who responded to any poll
        const responseRate = totalStudents > 0 ? Math.round((totalResponses / totalStudents) * 100) : 0
        const respondedStudents = totalResponses

        stats.push({
          section,
          totalStudents,
          respondedStudents,
          responseRate
        })
      }
    } else {
      // If no polls, just show basic stats
      for (const section of sections) {
        const sectionStudents = students.filter(s => s.section === section)
        stats.push({
          section,
          totalStudents: sectionStudents.length,
          respondedStudents: 0,
          responseRate: 0
        })
      }
    }

    setSectionStats(stats)
  }

  // Calculate section response rates for the current poll
  const calculateCurrentPollSectionStats = useCallback(() => {
    if (!selectedPoll || !responses.length) return []

    // Get the class details from the selected poll
    const pollClass = selectedPoll.class_name
    const pollDepartment = pollClass?.split(' ')[0] // Extract department from "Department Section"
    const pollSection = pollClass?.split(' ')[1]   // Extract section from "Department Section"
    
    console.log('Current poll class:', pollClass, 'Department:', pollDepartment, 'Section:', pollSection)
    
    // Only show sections that are relevant to this poll
    let relevantSections: string[] = []
    
    if (pollSection) {
      // If this is a specific section poll, only show that section
      relevantSections = [pollSection]
    } else if (pollDepartment) {
      // If this is a department-wide poll, show all sections in that department
      relevantSections = Array.from(new Set(
        students
          .filter(s => s.department === pollDepartment)
          .map(s => s.section)
      ))
    } else {
      // Fallback: show all sections
      relevantSections = Array.from(new Set(students.map(s => s.section)))
    }
    
    console.log('Relevant sections for this poll:', relevantSections)
    
    const currentPollStats: SectionStats[] = []

    for (const section of relevantSections) {
      const sectionStudents = students.filter(s => s.section === section)
      const totalStudents = sectionStudents.length
      const sectionStudentRegNos = sectionStudents.map(s => s.reg_no)
      
      // Count responses for this section in the current poll
      const sectionResponses = responses.filter(r => 
        sectionStudentRegNos.includes(r.student_reg_no)
      ).length
      
      // Calculate response rate for this specific poll
      const responseRate = totalStudents > 0 ? Math.round((sectionResponses / totalStudents) * 100) : 0

      console.log(`Section ${section}: ${sectionResponses}/${totalStudents} = ${responseRate}%`)

      currentPollStats.push({
        section,
        totalStudents,
        respondedStudents: sectionResponses,
        responseRate
      })
    }

    console.log('Final stats:', currentPollStats)
    return currentPollStats
  }, [selectedPoll, responses, students])

  const fetchPollResponses = useCallback(async (pollId: number) => {
    try {
      // First get the complete poll details including options
      const { data: pollData, error: pollError } = await supabase
        .from('polls')
        .select('class_id, title, options, poll_type, poll_category')
        .eq('id', pollId)
        .single()

      if (pollError) throw pollError

      // Get the class details
      const { data: classData, error: classError } = await supabase
        .from('classes')
        .select('department, section')
        .eq('id', pollData.class_id)
        .single()

      if (classError) throw classError

      // Get students in this specific class
      const { data: classStudents, error: studentsError } = await supabase
        .from('students')
        .select('reg_no, name, email, department, section')
        .eq('department', classData.department)
        .eq('section', classData.section)

      if (studentsError) throw studentsError

      // Get responses for this poll
      const { data: responsesData, error: responsesError } = await supabase
        .from('poll_responses')
        .select('*')
        .eq('poll_id', pollId)

      if (responsesError) throw responsesError

      // Match responses with student names
      const formattedResponses = responsesData.map((response: any) => {
        const student = classStudents.find(s => s.reg_no === response.student_reg_no)
        return {
        ...response,
          student_name: student?.name || 'Unknown',
          student_department: student?.department || 'Unknown',
          student_section: student?.section || 'Unknown'
        }
      })

      setResponses(formattedResponses)
      
      // Update the selectedPoll with complete poll data including options
      // We need to get the current poll from the polls array to avoid stale state
      const currentPoll = polls.find(p => p.id === pollId)
      if (currentPoll) {
        const updatedPoll = { 
          ...currentPoll, 
          classStudents: classStudents || [],
          options: pollData.options || [],
          poll_type: pollData.poll_type,
          poll_category: pollData.poll_category
        }
        console.log('Updated selectedPoll with classStudents:', updatedPoll)
        setSelectedPoll(updatedPoll)
      }
    } catch (error) {
      console.error('Error fetching responses:', error)
      toast.error('Failed to fetch responses')
    }
  }, [polls])

  const handleLogout = () => {
    localStorage.removeItem('hodData')
    router.push('/')
    toast.success('Logged out successfully')
  }

        

  const exportDepartmentData = () => {
    const studentsToExport = selectedSection === 'all' 
      ? students 
      : students.filter(student => student.section === selectedSection)
    
    // Get section-wise summary
    const sectionSummary = Array.from(new Set(studentsToExport.map(s => s.section))).map(section => {
      const sectionStudents = studentsToExport.filter(s => s.section === section)
      return {
        'Section': section,
        'Student Count': sectionStudents.length,
        'Department': hodData.department,
        'HOD': hodData.name
      }
    })
    
    const studentData = studentsToExport.map(student => ({
      'Registration Number': student.reg_no,
      'Name': student.name,
      'Email': student.email,
      'Department': student.department,
      'Section': student.section
    }))
    
    const filename = selectedSection === 'all' 
      ? `${hodData.department}_Students_${new Date().toLocaleDateString('en-GB').slice(0,5).replace('/', '-')}` 
      : `${hodData.department}_Section_${selectedSection}_Students_${new Date().toLocaleDateString('en-GB').slice(0,5).replace('/', '-')}`
    
    // Export with multiple sheets
    exportToExcelWithMultipleSheets([
      { name: 'Section Summary', data: sectionSummary },
      { name: 'Student Details', data: studentData }
    ], filename)
    
    toast.success(`Student data exported successfully with section summary! ${selectedSection !== 'all' ? `(Section ${selectedSection})` : ''}`)
  }

  const exportPollData = (poll: Poll) => {
    console.log('Export function called with poll:', poll)
    console.log('Responses length:', responses.length)
    console.log('Selected poll class students:', selectedPoll?.classStudents?.length)
    
    if (responses.length === 0) {
      toast.error('No responses to export')
      return
    }

    // Get students who haven't responded
    const respondedRegNos = responses.map(r => r.student_reg_no)
    const nonResponders = (selectedPoll?.classStudents || []).filter(student => !respondedRegNos.includes(student.reg_no))
    
    // Calculate option counts for summary
    let optionSummaryData: any[] = []
    if (poll.options && poll.options.length > 0) {
      optionSummaryData = poll.options.map((option, index) => {
        const count = responses.filter(r => {
          // Try to match by option_index first, then fall back to response text matching
          if (r.option_index === index) return true
          return r.response.startsWith(option) || r.response === option
        }).length
        return {
          'Option': option,
          'Count': count,
          'Percentage': responses.length > 0 ? Math.round((count / responses.length) * 100) : 0
        }
      })
    }

    // Export responded students with detailed response info
    const respondedData = responses.map(response => ({
      'Registration Number': response.student_reg_no,
      'Student Name': response.student_name,
      'Response': response.response,
      'Option Selected': (() => {
        if (poll.options && response.option_index !== null && response.option_index !== undefined) {
          return poll.options[response.option_index] || 'Unknown'
        }
        // Fallback: extract option from response text
        if (poll.options) {
          for (const option of poll.options) {
            if (response.response.startsWith(option)) {
              return option
            }
          }
        }
        return response.response
      })(),
      'Responded At': formatRespondedAt(response.responded_at),
      'Status': 'Responded'
    }))

    // Export non-responded students
    const nonRespondedData = nonResponders.map(student => ({
      'Registration Number': student.reg_no,
      'Name': student.name,
      'Email': student.email,
      'Department': student.department,
      'Section': student.section,
      'Status': 'Not Responded'
    }))
    
    console.log('nonRespondedData created:', nonRespondedData.length, 'items')

    // Get section and faculty information
    const sectionInfo = {
      'Poll Title': poll.title,
      'Class': poll.class_name,
      'Department': (selectedPoll?.classStudents?.[0]?.department) || 'Unknown',
      'Section': poll.class_name?.split(' ')[1] || 'Unknown',
      'Total Students': (selectedPoll?.classStudents?.length || 0),
      'Responded': responses.length,
      'Not Responded': nonResponders.length,
      'Response Rate': (selectedPoll?.classStudents?.length || 0) > 0 ? 
        Math.round((responses.length / (selectedPoll?.classStudents?.length || 1)) * 100) : 0
    }

    // Create section info sheet
    const sectionInfoData = Object.entries(sectionInfo).map(([key, value]) => ({
      'Field': key,
      'Value': value
    }))

    // Debug logging before export
    console.log('About to export with:')
    console.log('- sectionInfoData:', sectionInfoData.length, 'items')
    console.log('- optionSummaryData:', optionSummaryData.length, 'items')
    console.log('- respondedData:', respondedData.length, 'items')
    console.log('- nonRespondedData:', nonRespondedData.length, 'items')
    
    // Use the utility function for multiple sheets
    exportToExcelWithMultipleSheets([
      { name: 'Poll Summary', data: sectionInfoData },
      { name: 'Option Counts', data: optionSummaryData },
      { name: 'Responded Students', data: respondedData },
      { name: 'Non-Responded Students', data: nonRespondedData }
    ], `poll_${poll.id}_${poll.class_name?.replace(/\s+/g, '_')}_complete_data`)
    
    toast.success('Poll data exported successfully with detailed analysis and segregated option counts!')
  }

  // Enhanced export function for poll responses with faculty details
  const exportPollResponsesWithFaculty = async (poll: Poll) => {
    if (responses.length === 0) {
      toast.error('No responses to export')
      return
    }

    try {
      // Get faculty information for the poll
      const { data: facultyData, error: facultyError } = await supabase
        .from('staffs')
        .select('name, email')
        .eq('id', poll.staff_id)
        .single()

      if (facultyError) {
        console.error('Error fetching faculty data:', facultyError)
      }

      // Get students who haven't responded
      const respondedRegNos = responses.map(r => r.student_reg_no)
      const nonResponders = (selectedPoll?.classStudents || []).filter(student => !respondedRegNos.includes(student.reg_no))
      
      // Calculate option counts for summary
      let optionSummaryData: any[] = []
      if (poll.options && poll.options.length > 0) {
        optionSummaryData = poll.options.map((option, index) => {
          const count = responses.filter(r => {
            if (r.option_index === index) return true
            return r.response.startsWith(option) || r.response === option
          }).length
          return {
            'Option': option,
            'Count': count,
            'Percentage': responses.length > 0 ? Math.round((count / responses.length) * 100) : 0
          }
        })
      }

      // Export responded students with detailed response info
      const respondedData = responses.map(response => ({
        'Registration Number': response.student_reg_no,
        'Student Name': response.student_name,
        'Response': response.response,
        'Option Selected': (() => {
          if (poll.options && response.option_index !== null && response.option_index !== undefined) {
            return poll.options[response.option_index] || 'Unknown'
          }
          if (poll.options) {
            for (const option of poll.options) {
              if (response.response.startsWith(option)) {
                return option
              }
            }
          }
          return response.response
        })(),
        'Responded At': formatRespondedAt(response.responded_at),
        'Status': 'Responded'
      }))

      // Export non-responded students
      const nonRespondersData = nonResponders.map(student => ({
        'Registration Number': student.reg_no,
        'Name': student.name,
        'Email': student.email,
        'Department': student.department,
        'Section': student.section,
        'Status': 'Not Responded'
      }))

      // Get comprehensive section info with faculty details
      const comprehensiveInfo = {
        'Poll Title': poll.title,
        'Class': poll.class_name,
        'Department': (selectedPoll?.classStudents?.[0]?.department) || 'Unknown',
        'Section': poll.class_name?.split(' ')[1] || 'Unknown',
        'Faculty Name': facultyData?.name || 'Unknown',
        'Faculty Email': facultyData?.email || 'Unknown',
        'Total Students': (selectedPoll?.classStudents?.length || 0),
        'Responded': responses.length,
        'Not Responded': nonResponders.length,
        'Response Rate': (selectedPoll?.classStudents?.length || 0) > 0 ? 
          Math.round((responses.length / (selectedPoll?.classStudents?.length || 1)) * 100) : 0,
        'Export Date': new Date().toLocaleDateString('en-GB'),
        'Export Time': new Date().toLocaleTimeString('en-GB')
      }

      // Create comprehensive info sheet
      const comprehensiveInfoData = Object.entries(comprehensiveInfo).map(([key, value]) => ({
        'Field': key,
        'Value': value
      }))

      // Export with multiple sheets including faculty information
      exportToExcelWithMultipleSheets([
        { name: 'Poll Summary', data: comprehensiveInfoData },
        { name: 'Option Counts', data: optionSummaryData },
        { name: 'Responded Students', data: respondedData },
        { name: 'Non-Responded Students', data: nonRespondersData }
      ], `poll_${poll.id}_${poll.class_name?.replace(/\s+/g, '_')}_with_faculty_${new Date().toLocaleDateString('en-GB').replace(/\//g, '-')}`)
      
      toast.success('Poll data exported successfully with faculty details and segregated option counts!')
    } catch (error) {
      console.error('Error exporting poll data:', error)
      toast.error('Failed to export poll data')
    }
  }

  const handleDeletePoll = async (pollId: number) => {
    if (!window.confirm('Are you sure you want to delete this poll?')) {
      return
    }

    try {
      const { error } = await supabase
        .from('polls')
        .delete()
        .eq('id', pollId)

      if (error) throw error

      setPolls(polls.filter(poll => poll.id !== pollId))
      toast.success('Poll deleted successfully!')
    } catch (error) {
      console.error('Error deleting poll:', error)
      toast.error('Failed to delete poll')
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen dashboard-bg flex items-center justify-center">
        <div className="text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="mb-6"
          >
            <div className="w-20 h-20 bg-gradient-to-r from-secondary-500 to-accent-500 rounded-full flex items-center justify-center mx-auto mb-4 shadow-2xl">
              <UserCheck className="w-10 h-10 text-white" />
            </div>
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="mb-6"
          >
            <h2 className="text-2xl font-bold text-white mb-2">HOD Dashboard</h2>
            <p className="text-slate-300">{loadingProgress}</p>
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="flex justify-center space-x-2"
          >
            <motion.div
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
              className="w-3 h-3 bg-secondary-500 rounded-full"
            />
            <motion.div
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut", delay: 0.2 }}
              className="w-3 h-3 bg-accent-500 rounded-full"
            />
            <motion.div
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut", delay: 0.4 }}
              className="w-3 h-3 bg-primary-500 rounded-full"
            />
          </motion.div>
        </div>
      </div>
    )
  }

  const DashboardPage = () => {
    if (!hodData) {
      return null;
    }

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8']

  return (
    <div className="dashboard-bg">
      {/* Header */}
      <header className="header">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-secondary-500/20 rounded-full flex items-center justify-center border border-secondary-500/30">
                <UserCheck className="w-6 h-6 text-secondary-400" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-white">
                  HOD Dashboard
                </h1>
                                 <p className="text-sm text-slate-300">
                   {hodData.name} • {hodData.department} Department
                   {isRealtimeUpdating && (
                     <span className="ml-2 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                       <div className="w-2 h-2 bg-green-400 rounded-full mr-1 animate-pulse"></div>
                       Live
                     </span>
                   )}
                 </p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-2 text-slate-400 text-sm">
                {lastRefreshed && (
                  <span title={`Last refreshed: ${lastRefreshed.toLocaleTimeString()}`}>
                    Last: {lastRefreshed.toLocaleTimeString()}
                  </span>
                )}
              </div>
              <button
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="flex items-center space-x-2 text-slate-300 hover:text-white transition-colors px-3 py-2 rounded-lg hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
                title="Refresh data"
              >
                <RefreshCw className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} />
                <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
                {isRefreshing && (
                  <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
                )}
              </button>
              <button
                onClick={handleLogout}
                className="flex items-center space-x-2 text-slate-300 hover:text-white transition-colors px-3 py-2 rounded-lg hover:bg-slate-700"
              >
                <LogOut className="w-5 h-5" />
                <span>Logout</span>
              </button>
            </div>
          </div>
        </div>
      
    
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Tab Navigation */}
        <div className="flex space-x-1 mb-8 bg-slate-800 p-1 rounded-xl shadow-lg">
          {[
            { id: 'overview', label: 'Overview', icon: BarChart3 },
            { id: 'students', label: 'Students', icon: Users },
            { id: 'polls', label: 'Polls', icon: BarChart3 },
            { id: 'analytics', label: 'Analytics', icon: TrendingUp }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex-1 flex items-center justify-center space-x-2 py-3 px-4 rounded-lg font-medium transition-all duration-200 ${
                activeTab === tab.id
                  ? 'bg-secondary-500/20 text-secondary-400 border border-secondary-500/30'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <tab.icon className="w-5 h-5" />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="space-y-6">
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              {/* Department Overview Cards */}
              <div className="grid md:grid-cols-4 gap-6">
                <div className="card text-center group cursor-pointer" onClick={handleRefresh}>
                  <div className="w-12 h-12 bg-primary-500/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-primary-500/30 group-hover:bg-primary-500/30 transition-colors">
                    <Users className="w-6 h-6 text-primary-400" />
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-2">{students.length}</h3>
                  <p className="text-slate-300">Total Students</p>
                  <div className="mt-2 text-xs text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">
                    Click to refresh
                  </div>
                </div>
                <div className="card text-center group cursor-pointer" onClick={handleRefresh}>
                  <div className="w-12 h-12 bg-accent-500/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-accent-500/30 group-hover:bg-accent-500/30 transition-colors">
                    <Building className="w-6 h-6 text-accent-400" />
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-2">
                    {Array.from(new Set(students.map(s => s.section))).length}
                  </h3>
                  <p className="text-slate-300">Total Sections</p>
                  <div className="mt-2 text-xs text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">
                    Click to refresh
                  </div>
                </div>
                <div className="card text-center group cursor-pointer" onClick={handleRefresh}>
                  <div className="w-12 h-12 bg-secondary-500/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-secondary-500/30 group-hover:bg-secondary-500/30 transition-colors">
                    <BarChart3 className="w-6 h-6 text-secondary-400" />
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-2">{polls.length}</h3>
                  <p className="text-slate-300">Active Polls</p>
                  <div className="mt-2 text-xs text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">
                    Click to refresh
                  </div>
                </div>
                <div className="card text-center group cursor-pointer" onClick={handleRefresh}>
                  <div className="w-12 h-12 bg-orange-500/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-orange-500/30 group-hover:bg-orange-500/30 transition-colors">
                    <TrendingUp className="w-6 h-6 text-orange-400" />
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-2">
                    {students.length > 0 ? Math.round((students.length / students.length) * 100) : 0}%
                  </h3>
                  <p className="text-slate-300">Total Coverage</p>
                  <div className="mt-2 text-xs text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">
                    Click to refresh
                  </div>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="card">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-semibold text-white">Quick Actions</h2>
                  <button
                    onClick={handleRefresh}
                    disabled={isRefreshing}
                    className="flex items-center space-x-2 text-sm text-slate-400 hover:text-white transition-colors"
                  >
                    <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                    <span>{isRefreshing ? 'Refreshing...' : 'Refresh Data'}</span>
                  </button>
                </div>
                <div className="grid md:grid-cols-4 gap-4">
                  <button
                    onClick={() => setShowCreatePoll(true)}
                    className="flex items-center justify-center space-x-2 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg"
                  >
                    <Plus className="w-5 h-5" />
                    <span>Create Poll</span>
                  </button>
                  <button
                    onClick={handleRefresh}
                    disabled={isRefreshing}
                    className="btn-accent flex items-center justify-center space-x-2 py-4"
                    title="Refresh all data"
                  >
                    <RefreshCw className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} />
                    <span>{isRefreshing ? 'Refreshing...' : 'Refresh All Data'}</span>
                  </button>
                  <button
                    onClick={exportDepartmentData}
                    className="btn-secondary flex items-center justify-center space-x-2 py-4"
                  >
                    <Download className="w-5 h-5" />
                    <span>Export Department Data</span>
                  </button>
                  <button
                    onClick={() => setActiveTab('analytics')}
                    className="btn-accent flex items-center justify-center space-x-2 py-4"
                  >
                    <TrendingUp className="w-5 h-5" />
                    <span>View Detailed Analytics</span>
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* Students Tab */}
          {activeTab === 'students' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-2xl font-bold text-white">Department Students</h2>
                  <p className="text-sm text-slate-400 mt-1">
                    Showing {students.length} students across all sections in {hodData.department} Department
                  </p>
                </div>
                <div className="flex items-center space-x-3">
                  <button
                    onClick={handleRefresh}
                    disabled={isRefreshing}
                    className="btn-accent flex items-center space-x-2"
                    title="Refresh students data"
                  >
                    <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                    <span>Refresh</span>
                  </button>
                  <button
                    onClick={exportDepartmentData}
                    className="btn-secondary flex items-center space-x-2"
                  >
                    <Download className="w-5 h-5" />
                    <span>Export</span>
                  </button>
                </div>
              </div>

              {/* Two-column layout: Section boxes on left, students table on right */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left side: Section Summary with Clickable Boxes */}
                <div className="lg:col-span-1">
                  <div className="card">
                    <h3 className="text-lg font-semibold text-white mb-4">Section Breakdown</h3>
                    <div className="grid grid-cols-2 gap-3">
                      {Array.from(new Set(students.map(s => s.section))).sort().map(section => {
                        const sectionStudents = students.filter(s => s.section === section)
                        
                        // Define attractive colors for each section A to Q
                        const getSectionColors = (sectionLetter: string) => {
                          const colorMap: { [key: string]: { bg: string; border: string; text: string; hoverBg: string } } = {
                            'A': { bg: 'bg-blue-500/20', border: 'border-blue-500/30', text: 'text-blue-400', hoverBg: 'hover:bg-blue-500/30' },
                            'B': { bg: 'bg-emerald-500/20', border: 'border-emerald-500/30', text: 'text-emerald-400', hoverBg: 'hover:bg-emerald-500/30' },
                            'C': { bg: 'bg-purple-500/20', border: 'border-purple-500/30', text: 'text-purple-400', hoverBg: 'hover:bg-purple-500/30' },
                            'D': { bg: 'bg-orange-500/20', border: 'border-orange-500/30', text: 'text-orange-400', hoverBg: 'hover:bg-orange-500/30' },
                            'E': { bg: 'bg-pink-500/20', border: 'border-pink-500/30', text: 'text-pink-400', hoverBg: 'hover:bg-pink-500/30' },
                            'F': { bg: 'bg-indigo-500/20', border: 'border-indigo-500/30', text: 'text-indigo-400', hoverBg: 'hover:bg-indigo-500/30' },
                            'G': { bg: 'bg-teal-500/20', border: 'border-teal-500/30', text: 'text-teal-400', hoverBg: 'hover:bg-teal-500/30' },
                            'H': { bg: 'bg-rose-500/20', border: 'border-rose-500/30', text: 'text-rose-400', hoverBg: 'hover:bg-rose-500/30' },
                            'I': { bg: 'bg-cyan-500/20', border: 'border-cyan-500/30', text: 'text-cyan-400', hoverBg: 'hover:bg-cyan-500/30' },
                            'J': { bg: 'bg-amber-500/20', border: 'border-amber-500/30', text: 'text-amber-400', hoverBg: 'hover:bg-amber-500/30' },
                            'K': { bg: 'bg-lime-500/20', border: 'border-lime-500/30', text: 'text-lime-400', hoverBg: 'hover:bg-lime-500/30' },
                            'L': { bg: 'bg-violet-500/20', border: 'border-violet-500/30', text: 'text-violet-400', hoverBg: 'hover:bg-violet-500/30' },
                            'M': { bg: 'bg-sky-500/20', border: 'border-sky-500/30', text: 'text-sky-400', hoverBg: 'hover:bg-sky-500/30' },
                            'N': { bg: 'bg-fuchsia-500/20', border: 'border-fuchsia-500/30', text: 'text-fuchsia-400', hoverBg: 'hover:bg-fuchsia-500/30' },
                            'O': { bg: 'bg-yellow-500/20', border: 'border-yellow-500/30', text: 'text-yellow-400', hoverBg: 'hover:bg-yellow-500/30' },
                            'P': { bg: 'bg-red-500/20', border: 'border-red-500/30', text: 'text-red-400', hoverBg: 'hover:bg-red-500/30' },
                            'Q': { bg: 'bg-green-500/20', border: 'border-green-500/30', text: 'text-green-400', hoverBg: 'hover:bg-green-500/30' }
                          }
                          return colorMap[sectionLetter] || { bg: 'bg-slate-500/20', border: 'border-slate-500/30', text: 'text-slate-400', hoverBg: 'hover:bg-slate-500/30' }
                        }
                        
                        const colors = getSectionColors(section)
                        const isSelected = selectedSection === section
                        
                        return (
                          <button
                            key={section}
                            onClick={() => setSelectedSection(section === selectedSection ? 'all' : section)}
                            className={`text-center p-3 rounded-lg border transition-all duration-200 cursor-pointer ${colors.bg} ${colors.border} ${colors.hoverBg} ${
                              isSelected ? 'ring-2 ring-white ring-opacity-50 scale-105' : ''
                            }`}
                          >
                            <div className={`text-2xl font-bold ${colors.text}`}>
                              {sectionStudents.length}
                            </div>
                            <div className="text-sm text-slate-300">Section {section}</div>
                            <div className="text-xs text-slate-400 mt-1">
                              {sectionStudents.length} student{sectionStudents.length !== 1 ? 's' : ''}
                            </div>
                          </button>
                        )
                      })}
                    </div>
                    {/* Section Summary */}
                    <div className="mt-4 p-3 bg-slate-700 rounded-lg">
                      <p className="text-xs text-slate-400">
                        Total students: {students.length} | 
                        Sections: {Array.from(new Set(students.map(s => s.section))).sort().join(', ')} | 
                        Section Q: {students.filter(s => s.section === 'Q').length} students
                      </p>
                    </div>
                  </div>

                  {/* Section Filter */}
                  <div className="card mt-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold text-white">Filter by Section</h3>
                      <select
                        value={selectedSection}
                        onChange={(e) => setSelectedSection(e.target.value)}
                        className="input-field max-w-xs"
                      >
                        <option value="all">All Sections</option>
                        {Array.from(new Set(students.map(s => s.section))).sort().map(section => (
                          <option key={section} value={section}>Section {section}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Right side: Students Table */}
                <div className="lg:col-span-1">
                  <div className="card">
                    <div className="mb-4">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-white">
                          Showing {students.filter(student => selectedSection === 'all' || student.section === selectedSection).length} students
                          {selectedSection !== 'all' && ` in Section ${selectedSection}`}
                        </span>
                      </div>
                    </div>
                    <div className="overflow-x-auto">
                      <div className="rounded-xl overflow-hidden border border-slate-600/50 shadow-lg">
                        <table className="min-w-full">
                          <thead className="bg-gradient-to-r from-indigo-600/90 via-blue-600/90 to-cyan-600/90">
                            <tr>
                              <th className="px-6 py-4 text-left text-xs font-semibold text-white uppercase tracking-wider">
                                Registration No
                              </th>
                              <th className="px-6 py-4 text-left text-xs font-semibold text-white uppercase tracking-wider">
                                Name
                              </th>
                              <th className="px-6 py-4 text-left text-xs font-medium text-white uppercase tracking-wider">
                                Email
                              </th>
                            </tr>
                          </thead>
                          <tbody className="bg-gradient-to-b from-slate-900/95 to-slate-800/95">
                            {students
                              .filter(student => selectedSection === 'all' || student.section === selectedSection)
                              .map((student, index) => (
                                <tr key={student.reg_no} className={`hover:bg-gradient-to-r hover:from-indigo-500/10 hover:to-cyan-500/10 transition-all duration-200 ${index % 2 === 0 ? 'bg-slate-800/30' : 'bg-slate-700/30'}`}>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-indigo-300 font-medium">
                                    {student.reg_no}
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-white font-semibold">
                                    {student.name}
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">
                                    {student.email}
                                  </td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

                     {/* Polls Tab */}
           {activeTab === 'polls' && (
             <motion.div
               initial={{ opacity: 0, y: 20 }}
               animate={{ opacity: 1, y: 0 }}
               className="space-y-4"
             >
               <div className="flex justify-between items-center">
                 <h2 className="text-2xl font-bold text-white">Department Polls</h2>
                 <div className="flex items-center space-x-3">
                   <button
                     onClick={handleRefresh}
                     disabled={isRefreshing}
                     className="btn-accent flex items-center space-x-2"
                     title="Refresh polls data"
                   >
                     <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                     <span>Refresh</span>
                   </button>
                   <button
                     onClick={() => setShowCreatePoll(true)}
                     className="flex items-center space-x-2 bg-green-600 hover:bg-green-700 text-white rounded-lg px-4 py-2"
                   >
                     <Plus className="w-5 h-5" />
                     <span>Create Poll</span>
                   </button>
                 </div>
               </div>

               {polls.length === 0 ? (
                 <div className="text-center py-12">
                   <BarChart3 className="w-16 h-16 text-slate-400 mx-auto mb-4" />
                   <h3 className="text-lg font-medium text-white mb-2">No polls created yet</h3>
                   <p className="text-slate-300">Create polls for your department or view polls created by faculty.</p>
                 </div>
               ) : (
                 <div className="grid gap-4">
                   {polls.map((poll) => (
                     <div key={poll.id} className="card">
                       <div className="flex justify-between items-start">
                         <div className="flex-1">
                           <h3 className="text-lg font-semibold text-white mb-2">
                             {poll.title}
                           </h3>

                           <div className="text-sm text-slate-300">
                             Created by: {poll.staff_name} • Class: {poll.class_name} • Created: {formatCreatedAt(poll.created_at)}
                             {poll.deadline && (
                               <>
                                 <br />
                                 Deadline: {formatDeadline(poll.deadline)}
                                 {isPollExpired(poll.deadline) && (
                                   <span className="ml-2 text-red-400 font-medium">(Expired)</span>
                                 )}
                               </>
                             )}
                           </div>
                         </div>
                         <div className="flex items-center space-x-2">
                           <button
                             onClick={async () => {
                               console.log('View Analytics clicked for poll:', poll.id, poll.title, poll.class_name)
                               setSelectedPoll(poll)
                               console.log('selectedPoll set to:', poll.id, poll.title, poll.class_name)
                               await fetchPollResponses(poll.id)
                               console.log('After fetchPollResponses, selectedPoll:', selectedPoll?.id, selectedPoll?.title, selectedPoll?.class_name)
                               setActiveTab('analytics')
                             }}
                             className="btn-secondary flex items-center space-x-2"
                           >
                             <Eye className="w-4 h-4" />
                             <span>View Analytics</span>
                           </button>
                           <button
                             onClick={() => exportPollData(poll)}
                             className="btn-accent flex items-center space-x-2"
                           >
                             <Download className="w-4 h-4" />
                             <span>Export Basic</span>
                           </button>
                           <button
                             onClick={() => exportPollResponsesWithFaculty(poll)}
                             className="btn-secondary flex items-center space-x-2"
                           >
                             <Download className="w-4 h-4" />
                             <span>Export with Faculty</span>
                           </button>
                           <button
                             onClick={() => handleDeletePoll(poll.id)}
                             className="btn-danger flex items-center space-x-2"
                           >
                             <Trash2 className="w-4 h-4" />
                             <span>Delete</span>
                           </button>
                         </div>
                       </div>
                     </div>
                   ))}
                 </div>
               )}
             </motion.div>
           )}

          {/* Analytics Tab */}
          {activeTab === 'analytics' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-2xl font-bold text-white">Analytics Dashboard</h2>
                  {selectedPoll && (
                    <div className="mt-1">
                      <p className="text-slate-300">
                        Poll: {selectedPoll.title}
                      </p>
                      <p className="text-xs text-slate-400">
                        Class: {selectedPoll.class_name} | ID: {selectedPoll.id}
                      </p>
                    </div>
                  )}
                </div>
                {selectedPoll && (
                  <div className="flex items-center space-x-3">
                    <button
                      onClick={handleRefresh}
                      disabled={isRefreshing}
                      className="btn-accent flex items-center space-x-2"
                      title="Refresh analytics data"
                    >
                      <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                      <span>Refresh</span>
                    </button>
                    <button
                      onClick={() => exportPollData(selectedPoll)}
                      className="btn-secondary flex items-center space-x-2"
                    >
                      <Download className="w-4 h-4" />
                      <span>Export Basic</span>
                    </button>
                    <button
                      onClick={() => exportPollResponsesWithFaculty(selectedPoll)}
                      className="btn-accent flex items-center space-x-2"
                    >
                      <Download className="w-4 h-4" />
                      <span>Export with Faculty</span>
                    </button>
                  </div>
                )}
              </div>

              {!selectedPoll ? (
                <div className="text-center py-12">
                  <TrendingUp className="w-16 h-16 text-slate-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-white mb-2">Select a poll to view analytics</h3>
                  <p className="text-slate-300">Go to the Polls tab and click "View Analytics" on a poll.</p>
                </div>
              ) : !selectedPoll.classStudents ? (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-secondary-500 mx-auto mb-4"></div>
                  <h3 className="text-lg font-medium text-white mb-2">Loading poll data...</h3>
                  <p className="text-slate-300">Please wait while we fetch the poll details and student information.</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Response Statistics */}
                  <div className="card">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-lg font-semibold text-white">
                        Response Statistics
                      </h3>
                      <div className="text-sm text-slate-300">
                        {responses.length} of {selectedPoll?.classStudents?.length || 0} students responded
                        <br />
                        <span className="text-xs text-slate-400">
                          (Only for {selectedPoll?.class_name} - {selectedPoll?.classStudents?.length || 0} total students in this class)
                        </span>
                      </div>
                    </div>
                    <div className="grid md:grid-cols-3 gap-4">
                      <div className="text-center p-4 bg-green-500/20 rounded-lg border border-green-500/30">
                        <div className="text-2xl font-bold text-green-400">{responses.length}</div>
                        <div className="text-sm text-green-400">Responded</div>
                      </div>
                      <div className="text-center p-4 bg-red-500/20 rounded-lg border border-red-500/30">
                        <div className="text-2xl font-bold text-red-400">
                          {Math.max(0, (selectedPoll?.classStudents?.length || 0) - responses.length)}
                        </div>
                        <div className="text-sm text-red-400">Not Responded</div>
                      </div>
                      <div className="text-center p-4 bg-blue-500/20 rounded-lg border border-blue-500/30">
                        <div className="text-2xl font-bold text-blue-400">
                          {(selectedPoll?.classStudents?.length || 0) > 0 
                            ? Math.min(100, Math.round((responses.length / (selectedPoll?.classStudents?.length || 1)) * 100))
                            : 0}%
                        </div>
                        <div className="text-sm text-blue-400">Response Rate</div>
                      </div>
                    </div>
                  </div>

                  {/* Section-wise Response Chart */}
                  <div className="card">
                    <h3 className="text-lg font-semibold text-white mb-4">
                      {selectedPoll ? 'Section-wise Response Rate for Current Poll' : 'Overall Section Response Rates'}
                    </h3>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={selectedPoll ? calculateCurrentPollSectionStats() : sectionStats}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#475569" />
                          <XAxis dataKey="section" stroke="#94a3b8" />
                          <YAxis 
                            stroke="#94a3b8" 
                            domain={[0, 100]}
                            tickFormatter={(value) => `${value}%`}
                          />
                          <Tooltip 
                            contentStyle={{
                              backgroundColor: '#1e293b',
                              border: '1px solid #475569',
                              borderRadius: '8px',
                              color: '#f1f5f9'
                            }}
                            formatter={(value: any) => [`${value}%`, 'Response Rate']}
                          />
                          <Bar dataKey="responseRate" fill="#0ea5e9" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Individual Responses */}
                  <div className="card">
                    <h3 className="text-lg font-semibold text-white mb-4">Response Summary</h3>
                    
                    {/* Option Counts Summary */}
                    {selectedPoll?.options && selectedPoll.options.length > 0 && (
                      <div className="mb-6 p-4 bg-slate-700 rounded-lg border border-slate-600">
                        <h4 className="text-md font-medium text-white mb-3">
                          Option Counts 
                          {(() => {
                            const question = selectedPoll.title.toLowerCase()
                            const options = (selectedPoll.options as string[]).map(opt => opt.toLowerCase())
                            
                            const numericalKeywords = [
                              'how many', 'number of', 'problems solved', 'questions answered',
                              'score', 'points', 'marks', 'grade', 'level', 'difficulty',
                              'problems', 'questions', 'tasks', 'assignments', 'exercises'
                            ]
                            
                            const hasNumericalOptions = options.some(opt => 
                              /\d+/.test(opt) || 
                              ['none', 'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'].some(word => opt.includes(word))
                            )
                            
                            const isAchievementQuestion = numericalKeywords.some(keyword => 
                              question.includes(keyword)
                            )
                            
                            if (isAchievementQuestion && hasNumericalOptions) {
                              return ' (Best Performance First)'
                            } else {
                              return ' (Lowest Count First)'
                            }
                          })()}
                        </h4>
                        

                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                          {(() => {
                            // Calculate counts for each option - use both option_index and response text matching
                            const optionCounts = (selectedPoll?.options ?? []).map((option: string, index: number) => {
                              // Try to match by option_index first, then fall back to response text matching
                              let count = responses.filter(r => r.option_index === index).length
                              
                              // If no matches found by option_index, try matching by response text
                              if (count === 0) {
                                count = responses.filter(r => {
                                  // Check if response starts with the option text (for cases like "Yes - additional text")
                                  return r.response.startsWith(option) || r.response === option
                                }).length
                              }
                              
                              return { option, index, count }
                            })
                            
                            // Smart sorting based on poll question context
                            const shouldSortDescending = () => {
                              const question = selectedPoll.title.toLowerCase()
                              const options = (selectedPoll?.options ?? []).map((opt: string) => opt.toLowerCase())
                              
                              // Check if this is a numerical/achievement question
                              const numericalKeywords = [
                                'how many', 'number of', 'problems solved', 'questions answered',
                                'score', 'points', 'marks', 'grade', 'level', 'difficulty',
                                'problems', 'questions', 'tasks', 'assignments', 'exercises'
                              ]
                              
                              // Check if options contain numbers or represent quantities
                              const hasNumericalOptions = options.some(opt => 
                                /\d+/.test(opt) || 
                                ['none', 'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'].some(word => opt.includes(word))
                              )
                              
                              // Check if question asks about achievement/performance
                              const isAchievementQuestion = numericalKeywords.some(keyword => 
                                question.includes(keyword)
                              )
                              
                              return isAchievementQuestion && hasNumericalOptions
                            }
                            
                            // Sort based on context
                            if (shouldSortDescending()) {
                              // For achievement questions: sort by count in descending order (highest first)
                              optionCounts.sort((a, b) => b.count - a.count)
                            } else {
                              // For preference/opinion questions: sort by count in ascending order (lowest first)
                              optionCounts.sort((a, b) => a.count - b.count)
                            }
                            
                            return optionCounts.map(({ option, index, count }) => (
                              <div key={index} className="flex items-center justify-between p-3 bg-slate-600 rounded-lg border border-slate-500">
                                <div className="flex items-center space-x-3">
                                  <div className="w-8 h-8 bg-secondary-500 rounded-full flex items-center justify-center text-white text-sm font-medium">
                                    {index + 1}
                                  </div>
                                  <span className="text-slate-200 font-medium">{option}</span>
                                </div>
                                <div className="text-right">
                                  <div className="text-2xl font-bold text-secondary-400">{count}</div>
                                  <div className="text-xs text-slate-400">responses</div>
                                </div>
                              </div>
                            ))
                          })()}
                        </div>
                      </div>
                    )}
                    
                    <h3 className="text-lg font-semibold text-white mb-4">Individual Responses</h3>
                    
                    {/* Response Statistics Summary - Side by Side */}
                    <div className="mb-6">
                      <h4 className="text-md font-medium text-white mb-4">Response Overview</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Responded Students Card */}
                        <div className="bg-gradient-to-br from-green-500/20 to-green-600/20 rounded-xl border border-green-500/30 p-6">
                          <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center space-x-3">
                              <div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center border border-green-500/40">
                                <div className="w-6 h-6 bg-green-400 rounded-full flex items-center justify-center">
                                  <span className="text-white text-sm font-bold">✓</span>
                                </div>
                              </div>
                              <div>
                                <h5 className="text-lg font-semibold text-white">Responded</h5>
                                <p className="text-green-300 text-sm">Students who completed the poll</p>
                              </div>
                            </div>
                          </div>
                          <div className="text-center">
                            <div className="text-4xl font-bold text-green-400 mb-2">{responses.length}</div>
                            <div className="text-green-300 text-sm">
                              {(selectedPoll?.classStudents?.length || 0) > 0 ? Math.round((responses.length / (selectedPoll?.classStudents?.length || 1)) * 100) : 0}% of class
                            </div>
                          </div>
                        </div>

                        {/* Not Responded Students Card */}
                        <div className="bg-gradient-to-br from-red-500/20 to-red-600/20 rounded-xl border border-red-500/30 p-6">
                          <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center space-x-3">
                              <div className="w-12 h-12 bg-red-500/20 rounded-full flex items-center justify-center border border-red-500/40">
                                <div className="w-6 h-6 bg-red-400 rounded-full flex items-center justify-center">
                                  <span className="text-white text-sm font-bold">!</span>
                                </div>
                              </div>
                              <div>
                                <h5 className="text-lg font-semibold text-white">Not Responded</h5>
                                <p className="text-red-300 text-sm">Students who haven't completed the poll</p>
                              </div>
                            </div>
                          </div>
                          <div className="text-center">
                            <div className="text-4xl font-bold text-red-400 mb-2">{Math.max(0, (selectedPoll?.classStudents?.length || 0) - responses.length)}</div>
                            <div className="text-red-300 text-sm">
                              {(selectedPoll?.classStudents?.length || 0) > 0 ? Math.round((Math.max(0, (selectedPoll?.classStudents?.length || 0) - responses.length) / (selectedPoll?.classStudents?.length || 1)) * 100) : 0}% of class
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Additional Info Row */}
                      <div className="mt-4 p-4 bg-slate-700/50 rounded-lg border border-slate-600">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                          <div className="text-center">
                            <span className="text-slate-300">Targeted Class: </span>
                            <span className="text-white font-medium">{selectedPoll?.class_name}</span>
                          </div>
                          <div className="text-center">
                            <span className="text-slate-300">Total Students: </span>
                            <span className="text-white font-medium">{selectedPoll?.classStudents?.length || 0}</span>
                          </div>
                          <div className="text-center">
                            <span className="text-slate-300">Response Rate: </span>
                            <span className="text-white font-medium">
                              {(selectedPoll?.classStudents?.length || 0) > 0 ? Math.round((responses.length / (selectedPoll?.classStudents?.length || 1)) * 100) : 0}%
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Tabs for Responses and Non-Responders */}
                    <div className="mb-4">
                      <div className="flex space-x-1 bg-slate-700 p-1 rounded-lg">
                        <button
                          onClick={() => setActiveTab('analytics')}
                          className="flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors bg-secondary-500/20 text-secondary-400 border border-secondary-500/30"
                        >
                          Responses ({responses.length})
                        </button>
                        <button
                          onClick={() => setActiveTab('analytics')}
                          className="flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors text-slate-300 hover:text-white hover:bg-slate-600"
                        >
                          Non-Responders ({Math.max(0, (selectedPoll?.classStudents?.length || 0) - responses.length)})
                        </button>
                      </div>
                    </div>

                    {/* Side by Side Tables Layout */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 xl:gap-8">
                      {/* Left Side: Responded Students */}
                      <div className="min-w-0">
                        <h4 className="text-lg font-semibold text-white mb-4 flex items-center">
                          <div className="w-3 h-3 bg-emerald-400 rounded-full mr-3"></div>
                          Students Who Responded ({responses.length})
                        </h4>
                        <div className="overflow-x-auto">
                          <div className="rounded-xl overflow-hidden border border-slate-600/50 shadow-lg">
                            <table className="w-full">
                              <thead className="bg-gradient-to-r from-emerald-600/90 via-teal-600/90 to-cyan-600/90">
                                <tr>
                                  <th className="px-6 py-4 text-left text-xs font-semibold text-white uppercase tracking-wider w-1/3">
                                    Student
                                  </th>
                                  <th className="px-6 py-4 text-left text-xs font-semibold text-white uppercase tracking-wider w-1/3">
                                    Response
                                  </th>
                                  <th className="px-6 py-4 text-left text-xs font-semibold text-white uppercase tracking-wider w-1/3">
                                    Time
                                  </th>
                                </tr>
                              </thead>
                              <tbody className="bg-gradient-to-b from-slate-900/95 to-slate-800/95">
                                {responses.map((response, index) => (
                                  <tr key={response.id} className={`hover:bg-gradient-to-r hover:from-emerald-500/10 hover:to-teal-500/10 transition-all duration-200 ${index % 2 === 0 ? 'bg-slate-800/30' : 'bg-slate-700/30'}`}>
                                    <td className="px-6 py-4 text-sm text-white font-medium">
                                      {response.student_name}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-slate-200">
                                      {response.response}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-emerald-300">
                                      {formatRespondedAt(response.responded_at)}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>

                      {/* Right Side: Non-Responders */}
                      <div className="min-w-0">
                        <h4 className="text-lg font-semibold text-white mb-4 flex items-center">
                          <div className="w-3 h-3 bg-amber-400 rounded-full mr-3"></div>
                          Students Who Haven't Responded ({Math.max(0, (selectedPoll?.classStudents?.length || 0) - responses.length)})
                        </h4>
                        
                        {/* Debug info - temporary */}
                        <div className="mb-4 p-3 bg-slate-800 rounded-lg border border-slate-600">
                          <p className="text-xs text-slate-400 mb-2">Debug Info:</p>
                          <p className="text-xs text-slate-400">Class Students Count: {selectedPoll?.classStudents?.length || 0}</p>
                          <p className="text-xs text-slate-400">Responses Count: {responses.length}</p>
                          <p className="text-xs text-slate-400">Non-Responders Count: {Math.max(0, (selectedPoll?.classStudents?.length || 0) - responses.length)}</p>
                          <p className="text-xs text-slate-400">Selected Poll ID: {selectedPoll?.id}</p>
                          <p className="text-xs text-slate-400">Class Name: {selectedPoll?.class_name}</p>
                        </div>
                        
                        {selectedPoll?.classStudents && selectedPoll.classStudents.length > 0 ? (
                          <div className="overflow-x-auto">
                            <div className="rounded-xl overflow-hidden border border-slate-600/50 shadow-lg">
                              <table className="w-full">
                                <thead className="bg-gradient-to-r from-amber-600/90 via-orange-600/90 to-red-600/90">
                                  <tr>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-white uppercase tracking-wider w-1/4">
                                      Student
                                    </th>
                                    <th className="px-6 py-4 text-left text-xs font-medium text-white uppercase tracking-wider w-1/4">
                                      Registration No
                                    </th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-white uppercase tracking-wider w-2/4">
                                      Email
                                    </th>
                                  </tr>
                                </thead>
                                <tbody className="bg-gradient-to-b from-slate-900/95 to-slate-800/95">
                                  {(selectedPoll?.classStudents || [])
                                    .filter(student => !responses.some(r => r.student_reg_no === student.reg_no))
                                    .map((student, index) => (
                                      <tr key={student.reg_no} className={`hover:bg-gradient-to-r hover:from-amber-500/10 hover:to-orange-500/10 transition-all duration-200 ${index % 2 === 0 ? 'bg-slate-800/30' : 'bg-slate-700/30'}`}>
                                        <td className="px-6 py-4 text-sm text-white font-medium">
                                          {student.name}
                                        </td>
                                        <td className="text-sm text-cyan-300 font-mono">
                                          {student.reg_no}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-slate-300 break-all">
                                          {student.email}
                                        </td>
                                      </tr>
                                    ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        ) : (
                          <div className="text-center py-8 bg-slate-700/50 rounded-lg border border-slate-600">
                            <p className="text-slate-400">No class students data available</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </div>
      </div>

      {/* Create Poll Modal */}
      {showCreatePoll && (
        <CreatePollModal
          hodData={hodData}
          onClose={() => setShowCreatePoll(false)}
          onPollCreated={() => {
            setShowCreatePoll(false)
            fetchDepartmentData(hodData)
            toast.success('Poll created successfully!')
          }}
        />
      )}
    </div>
  )
}

// Create Poll Modal Component for HOD
function CreatePollModal({ 
  hodData, 
  onClose, 
  onPollCreated 
}: { 
  hodData: any
  onClose: () => void
  onPollCreated: () => void
}) {
  const [title, setTitle] = useState('')
  const [selectedSections, setSelectedSections] = useState<string[]>([])
  const [pollCategory, setPollCategory] = useState<'General Poll' | 'Hackathon' | 'G-Form Poll'>('General Poll')
  const [options, setOptions] = useState(['Yes', 'No'])
  const [deadline, setDeadline] = useState('')
  const [linkUrl, setLinkUrl] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isCreating, setIsCreating] = useState(false)

  const handleSectionToggle = (section: string) => {
    setSelectedSections(prev => 
      prev.includes(section) 
        ? prev.filter(s => s !== section)
        : [...prev, section]
    )
  }

  const addOption = () => {
    if (options.length < 5) {
      setOptions([...options, ''])
    }
  }

  const removeOption = (index: number) => {
    if (options.length > 2) {
      setOptions(options.filter((_, i) => i !== index))
    }
  }

  const updateOption = (index: number, value: string) => {
    const newOptions = [...options]
    newOptions[index] = value
    setOptions(newOptions)
  }

  // Reset options when category changes
  const handleCategoryChange = (category: 'General Poll' | 'Hackathon' | 'G-Form Poll') => {
    setPollCategory(category)
    if (category === 'General Poll') {
      setOptions(['Yes', 'No']) // Reset to default options for General Poll
    } else {
      setOptions(['Yes', 'No']) // Reset to default options for other categories
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!title.trim()) {
      toast.error('Please enter a poll title')
      return
    }
    if (selectedSections.length === 0) {
      toast.error('Please select at least one section')
      return
    }
    // Always validate options for all poll types
    const validOptions = options.filter(opt => opt.trim() !== '')
    if (validOptions.length < 2) {
      toast.error('Please provide at least 2 options')
      return
    }
    if (pollCategory === 'G-Form Poll' && !linkUrl.trim()) {
      toast.error('Please provide the G-Form link')
      return
    }
    if (pollCategory === 'Hackathon' && !linkUrl.trim()) {
      toast.error('Please provide the hackathon link')
      return
    }

    setIsSubmitting(true)
    setIsCreating(true)
    try {
      // Get class IDs for selected sections
      const { data: classesData, error: classesError } = await supabase
        .from('classes')
        .select('id')
        .eq('department', hodData.department)
        .in('section', selectedSections)

      if (classesError) throw classesError
      const classIds = classesData.map(c => c.id)

      // Create polls for each selected class
      for (const classId of classIds) {
        const pollData = {
          title: title.trim(),
          staff_id: hodData.id,
          class_id: classId,
          poll_type: 'options', // Always set to options since we always have radio buttons
          poll_category: pollCategory,
          options: options.filter(opt => opt.trim() !== ''),
          created_at: new Date().toTimeString().split(' ')[0], // Store as time only (HH:MM:SS)
          deadline: deadline || null, // Store only time (HH:MM:SS) or null
          link_url: linkUrl.trim() || null // Store the link if provided
        }

        const { data: insertResult, error } = await supabase
          .from('polls')
          .insert(pollData)
          .select()

        if (error) throw error
      }

      onPollCreated()
    } catch (error) {
      console.error('Error creating poll:', error)
      toast.error('Failed to create poll')
    } finally {
      setIsSubmitting(false)
      setIsCreating(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-slate-800 rounded-2xl shadow-xl p-6 w-full max-w-6xl max-h-[90vh] overflow-y-auto border border-slate-700"
      >
        <h2 className="text-xl font-semibold text-white mb-6">Create New Poll</h2>
        
        {/* Loading Overlay */}
        {isCreating && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 bg-slate-900/80 rounded-2xl flex items-center justify-center z-10"
          >
            <div className="text-center">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                className="w-16 h-16 border-4 border-secondary-500 border-t-transparent rounded-full mx-auto mb-4"
              />
              <p className="text-white text-lg font-medium">Creating Polls...</p>
              <p className="text-slate-300 text-sm mt-2">Please wait while we set up polls for all selected sections</p>
            </div>
          </motion.div>
        )}
        
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* First Row - Title and Category */}
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label htmlFor="title" className="block text-sm font-medium text-slate-200 mb-3">
                Poll Question
              </label>
              <input
                id="title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Are you present for today's contest?"
                className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-white placeholder-slate-400"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-200 mb-3">
                Poll Category
              </label>
              <div className="grid grid-cols-1 gap-3">
                {[
                  { value: 'General Poll', label: 'General Poll', color: 'bg-blue-500 hover:bg-blue-600' },
                  { value: 'Hackathon', label: 'Hackathon', color: 'bg-green-500 hover:bg-green-600' },
                  { value: 'G-Form Poll', label: 'G-Form Poll', color: 'bg-purple-500 hover:bg-purple-600' }
                ].map((category) => (
                  <button
                    key={category.value}
                    type="button"
                    onClick={() => handleCategoryChange(category.value as 'General Poll' | 'Hackathon' | 'G-Form Poll')}
                    className={`w-full py-3 px-4 rounded-lg text-white font-medium transition-colors ${
                      pollCategory === category.value 
                        ? category.color 
                        : 'bg-slate-600 hover:bg-slate-500 text-slate-200'
                    }`}
                  >
                    {category.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Second Row - Link/Options and Deadline */}
          <div className="grid grid-cols-2 gap-4">
            {/* General Poll: Compact options editor on left; Others: link field */}
            {pollCategory === 'General Poll' ? (
              <div>
                <label className="block text-sm font-medium text-slate-200 mb-2">
                  Poll Options
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {options.map((option, index) => (
                    <div key={index} className="flex items-center space-x-2">
                      <input
                        type="text"
                        value={option}
                        onChange={(e) => updateOption(index, e.target.value)}
                        placeholder={`Option ${index + 1}`}
                        className="flex-1 px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-white placeholder-slate-400"
                        required
                      />
                      {options.length > 2 && (
                        <button
                          type="button"
                          onClick={() => removeOption(index)}
                          className="px-2 py-2 text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded-lg transition-colors"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                {options.length < 5 && (
                  <button
                    type="button"
                    onClick={addOption}
                    className="mt-2 w-full py-2 px-3 border-2 border-dashed border-slate-600 text-slate-300 hover:border-slate-500 hover:text-slate-200 rounded-lg transition-colors"
                  >
                    + Add Option
                  </button>
                )}
              </div>
            ) : (
              <div>
                <label htmlFor="linkUrl" className="block text-sm font-medium text-slate-200 mb-2">
                  {pollCategory === 'Hackathon' ? 'Hackathon Link' : 'G-Form Link'}
                </label>
                <input
                  id="linkUrl"
                  type="url"
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  placeholder={pollCategory === 'Hackathon' ? 'https://hackathon-event.com' : 'https://forms.google.com/...'}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-white placeholder-slate-400"
                  required
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-200 mb-2">
                Deadline Time (Optional)
              </label>
              <input
                type="time"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-white"
                min={new Date().toTimeString().slice(0, 5)}
              />
            </div>
          </div>

          {/* Third Row removed; options now appear above for General Poll */}

          {/* Fourth Row - Text Response Field for General Poll (compact preview) */}
          {pollCategory === 'General Poll' && (
            <div>
              <label className="block text-sm font-medium text-slate-200 mb-2">
                Text Response Field (Optional)
              </label>
              <input
                type="text"
                disabled
                placeholder="Students can add a text response (optional)"
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-300"
              />
            </div>
          )}

          {/* Fifth Row - Target Sections */}
          <div>
            <label className="block text-sm font-medium text-slate-200 mb-3">
              Target Sections
            </label>
            <div className="mb-4">
              <button
                type="button"
                onClick={() => {
                  if (selectedSections.length === 17) {
                    setSelectedSections([])
                  } else {
                    const allSections = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q']
                    setSelectedSections(allSections)
                  }
                }}
                className={`w-full py-3 px-4 rounded-lg transition-colors font-medium ${
                  selectedSections.length === 17 
                    ? 'bg-slate-600 text-white hover:bg-slate-500' 
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                {selectedSections.length === 17 ? 'Clear All' : 'Select All'}
              </button>
            </div>
            <div className="grid grid-cols-5 gap-1.5">
              {['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q'].map(section => {
                const isSelected = selectedSections.includes(section)
                return (
                  <button
                    key={section}
                    type="button"
                    onClick={() => handleSectionToggle(section)}
                    className={`py-2 px-3 rounded-lg border transition-colors text-sm font-medium ${
                      isSelected 
                        ? 'bg-secondary-500 text-white border-secondary-500' 
                        : 'bg-slate-700 text-slate-200 border-slate-600 hover:bg-slate-600'
                    }`}
                  >
                    {section}
                  </button>
                )
              })}
            </div>
            <div className="mt-2 text-sm text-slate-400 text-center">
              Selected: {selectedSections.length} section(s)
            </div>
          </div>
          
          {/* Action Buttons */}
          <div className="flex space-x-4 pt-6">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 px-4 bg-slate-600 text-slate-200 rounded-lg hover:bg-slate-500 transition-colors font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 py-3 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium flex items-center justify-center space-x-2"
            >
              {isSubmitting ? (
                <>
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    className="w-5 h-5 border-2 border-white border-t-transparent rounded-full"
                  />
                  <span>Creating...</span>
                </>
              ) : (
                'Create Poll'
              )}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  )
}

  return <DashboardPage />
}
