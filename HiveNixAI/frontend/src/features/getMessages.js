import React from 'react'
import api from '../../utils/axios'

async function getMessages(id) {
    try {
        const { data } = await api.get(`/api/chat/get-message/${id}`)
        return data
    } catch (error) {
        console.log(error)
        return []
    }

}

export default getMessages