import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const required = [
  'username', 'password', 'studentNumber', 'name', 'school',
  'classNumber', 'company', 'startDate', 'endDate',
]

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const authorization = request.headers.get('Authorization')
    if (!authorization?.startsWith('Bearer ')) throw new Error('로그인이 필요합니다.')

    const url = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const admin = createClient(url, serviceKey, { auth: { persistSession: false } })
    const token = authorization.slice(7)
    const { data: authData, error: authError } = await admin.auth.getUser(token)
    if (authError || !authData.user) throw new Error('유효하지 않은 로그인입니다.')

    const { data: caller } = await admin
      .from('profiles')
      .select('role')
      .eq('id', authData.user.id)
      .single()
    if (caller?.role !== 'ADMIN') throw new Error('관리자 권한이 필요합니다.')

    const input = await request.json()
    if (required.some((key) => !String(input[key] ?? '').trim())) {
      throw new Error('학생 계정 정보를 모두 입력해주세요.')
    }
    if (String(input.password).length < 8) throw new Error('비밀번호는 8자 이상이어야 합니다.')
    if (input.startDate > input.endDate) throw new Error('실습 기간을 확인해주세요.')

    const username = String(input.username).trim()
    const { data, error } = await admin.auth.admin.createUser({
      email: `${username}@hoesawasso.local`,
      password: input.password,
      email_confirm: true,
      user_metadata: {
        username,
        student_number: String(input.studentNumber).trim(),
        name: String(input.name).trim(),
        school: String(input.school).trim(),
        class_number: String(input.classNumber).trim(),
        company: String(input.company).trim(),
        start_date: input.startDate,
        end_date: input.endDate,
      },
    })
    if (error) throw error

    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .select('*')
      .eq('id', data.user.id)
      .single()
    if (profileError) {
      await admin.auth.admin.deleteUser(data.user.id)
      throw profileError
    }

    return Response.json({ profile }, { headers: corsHeaders })
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : '학생 생성에 실패했습니다.' },
      { status: 400, headers: corsHeaders },
    )
  }
})
